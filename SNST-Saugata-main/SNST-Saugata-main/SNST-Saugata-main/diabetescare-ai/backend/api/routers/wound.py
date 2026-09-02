"""
Wound Severity Classification API Endpoint

Exposes /wound/classify endpoint that:
- Accepts wound image upload
- Runs EfficientNet-B0 inference
- Returns Wagner grade classification (0-5)
- Provides clinical recommendations
- Logs inference event

Owner: Saugata Malakar (wound severity model) + Sahil Kumar Gupta (API)
Integration: ml/wound_severity/inference.py
"""

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import io
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/wound", tags=["wound-inference"])


# Global model instance (loaded once at startup)
_wound_inference_api = None


def get_wound_inference_api():
    """
    Get or initialize wound inference API.
    
    Lazy loading to avoid importing ML dependencies at module load time.
    """
    global _wound_inference_api
    
    if _wound_inference_api is None:
        try:
            from ml.wound_severity.inference import WoundSeverityAPI
            from backend.utils.config import settings
            
            model_path = settings.WOUND_MODEL_PATH
            device = settings.INFERENCE_DEVICE
            
            logger.info(f"Loading wound severity model from {model_path}")
            _wound_inference_api = WoundSeverityAPI(
                model_path=model_path,
                device=device
            )
            logger.info("Wound severity model loaded successfully ✓")
            
        except Exception as e:
            logger.error(f"Failed to load wound severity model: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Wound classification service unavailable: {str(e)}"
            )
    
    return _wound_inference_api


# Request/Response Models

class WoundClassificationRequest(BaseModel):
    """Wound classification request metadata."""
    patient_id: Optional[str] = Field(None, description="Patient identifier (optional)")
    session_id: Optional[str] = Field(None, description="Monitoring session ID (optional)")
    wound_site: Optional[str] = Field(None, description="Wound location (e.g., 'left_foot')")
    previous_grade: Optional[int] = Field(None, description="Previous Wagner grade (for tracking)")


class WoundClassificationResponse(BaseModel):
    """Wound classification response."""
    status: str = "success"
    wagner_grade: int = Field(..., description="Wagner grade (0-5)")
    grade_label: str = Field(..., description="Grade label (e.g., 'Superficial')")
    description: str = Field(..., description="Clinical description")
    severity: str = Field(..., description="Severity level (e.g., 'Moderate')")
    recommendation: str = Field(..., description="Clinical recommendation")
    confidence: float = Field(..., description="Model confidence (0-1)")
    high_confidence: bool = Field(..., description="Confidence above threshold")
    class_probabilities: Dict[str, float] = Field(..., description="Probabilities for all grades")
    metadata: Dict[str, Any] = Field(..., description="Inference metadata")
    api_metadata: Optional[Dict[str, Any]] = Field(None, description="API-specific metadata")


class WoundClassificationError(BaseModel):
    """Wound classification error response."""
    status: str = "error"
    error: str
    timestamp: str
    api_metadata: Optional[Dict[str, Any]] = None


# Endpoints

@router.post("/classify", response_model=WoundClassificationResponse)
async def classify_wound(
    image: UploadFile = File(..., description="Wound image (JPEG/PNG)"),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    wound_site: Optional[str] = Form(None),
    previous_grade: Optional[int] = Form(None),
) -> WoundClassificationResponse:
    """
    Classify wound severity using EfficientNet-B0 model.
    
    Process:
    1. Validate image format
    2. Load and preprocess image
    3. Run inference
    4. Return Wagner grade + recommendations
    5. Log inference event
    
    Args:
        image: Wound photograph (JPEG/PNG)
        patient_id: Optional patient identifier
        session_id: Optional monitoring session ID
        wound_site: Optional wound location
        previous_grade: Optional previous Wagner grade
    
    Returns:
        Wagner grade classification with clinical recommendations
    
    Raises:
        HTTPException 400 if image invalid
        HTTPException 503 if model unavailable
    """
    
    # Validate image format
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {image.content_type}. Expected image/jpeg or image/png"
        )
    
    try:
        # Read image data
        image_data = await image.read()
        
        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(image_data))
        
        # Validate image dimensions
        width, height = pil_image.size
        if width < 100 or height < 100:
            raise HTTPException(
                status_code=400,
                detail=f"Image too small: {width}x{height}. Minimum 100x100 pixels required"
            )
        
        if width > 4000 or height > 4000:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large: {width}x{height}. Maximum 4000x4000 pixels"
            )
        
        # Get inference API
        wound_api = get_wound_inference_api()
        
        # Run classification
        result = wound_api.classify_wound(
            image_data=pil_image,
            patient_id=patient_id,
            session_id=session_id
        )
        
        # Check for errors
        if "error" in result:
            logger.error(f"Wound classification failed: {result['error']}")
            raise HTTPException(
                status_code=500,
                detail=f"Classification failed: {result['error']}"
            )
        
        # Add API metadata
        result["api_metadata"] = {
            "patient_id": patient_id,
            "session_id": session_id,
            "wound_site": wound_site,
            "previous_grade": previous_grade,
            "api_version": "v1.0",
            "status": "success",
            "image_size": f"{width}x{height}",
            "image_format": image.content_type
        }
        
        # Log inference event
        _log_inference_event(
            patient_id=patient_id,
            session_id=session_id,
            wagner_grade=result["wagner_grade"],
            confidence=result["confidence"],
            image_hash=result["metadata"]["image_hash"]
        )
        
        logger.info(
            f"Wound classified: Grade {result['wagner_grade']} "
            f"({result['grade_label']}) | Confidence: {result['confidence']:.3f}"
        )
        
        return WoundClassificationResponse(**result)
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Unexpected error in wound classification: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/predict")
async def predict_wound(
    file: UploadFile = File(..., description="Wound image (JPEG/PNG)")
) -> Dict[str, Any]:
    """
    Simple prediction endpoint for frontend compatibility.
    
    Args:
        file: Wound photograph (JPEG/PNG)
    
    Returns:
        Simple prediction response with class and confidence
    """
    try:
        # Call the main classify endpoint
        result = await classify_wound(
            image=file,
            patient_id=None,
            session_id=None,
            wound_site=None,
            previous_grade=None
        )
        
        # Return simplified response for frontend
        return {
            "prediction": result.grade_label,
            "class": result.grade_label,
            "confidence": result.confidence,
            "all_predictions": result.class_probabilities,
            "probabilities": result.class_probabilities,
            "processing_time": result.metadata.get("inference_time_ms", 0) / 1000,
            "model_version": "1.0.0",
            "wagner_grade": result.wagner_grade,
            "severity": result.severity,
            "recommendation": result.recommendation
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/classify/batch")
async def classify_wounds_batch(
    images: list[UploadFile] = File(..., description="Multiple wound images"),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
) -> Dict[str, Any]:
    """
    Classify multiple wound images in batch.
    
    Args:
        images: List of wound photographs
        patient_id: Optional patient identifier
        session_id: Optional monitoring session ID
    
    Returns:
        List of classification results
    """
    
    if len(images) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 images per batch request"
        )
    
    results = []
    
    for idx, image in enumerate(images):
        try:
            result = await classify_wound(
                image=image,
                patient_id=patient_id,
                session_id=session_id,
                wound_site=f"image_{idx+1}"
            )
            results.append(result.dict())
        
        except HTTPException as e:
            results.append({
                "status": "error",
                "error": e.detail,
                "image_index": idx,
                "filename": image.filename
            })
    
    return {
        "status": "completed",
        "total_images": len(images),
        "successful": sum(1 for r in results if r.get("status") == "success"),
        "failed": sum(1 for r in results if r.get("status") == "error"),
        "results": results
    }


@router.get("/model/info")
async def get_model_info() -> Dict[str, Any]:
    """
    Get wound severity model information.
    
    Returns:
        Model metadata and configuration
    """
    try:
        wound_api = get_wound_inference_api()
        return wound_api.get_model_info()
    
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Model information unavailable: {str(e)}"
        )


@router.get("/model/health")
async def model_health_check() -> Dict[str, Any]:
    """
    Health check for wound severity model.
    
    Returns:
        Model health status
    """
    try:
        wound_api = get_wound_inference_api()
        return wound_api.health_check()
    
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.get("/grades")
async def get_wagner_grades() -> Dict[str, Any]:
    """
    Get Wagner grade definitions and descriptions.
    
    Returns:
        Wagner grade reference information
    """
    from ml.wound_severity.model import ModelConfig
    
    return {
        "wagner_grades": ModelConfig.WAGNER_GRADES,
        "class_distribution": ModelConfig.CLASS_DISTRIBUTION,
        "target_accuracy": ModelConfig.TARGET_ACCURACY,
        "model_architecture": ModelConfig.MODEL_NAME
    }


# Helper functions

def _log_inference_event(
    patient_id: Optional[str],
    session_id: Optional[str],
    wagner_grade: int,
    confidence: float,
    image_hash: str
) -> None:
    """
    Log wound inference event to audit logs.
    
    Args:
        patient_id: Patient identifier
        session_id: Session identifier
        wagner_grade: Predicted Wagner grade
        confidence: Model confidence
        image_hash: Image hash for tracking
    """
    import json
    
    log_entry = {
        "action": "wound_inference",
        "patient_id": patient_id,
        "session_id": session_id,
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": json.dumps({
            "wagner_grade": wagner_grade,
            "confidence": confidence,
            "image_hash": image_hash,
            "model_version": "wound_v1.0"
        })
    }
    
    # TODO: Save to database
    # db_session.add(AuditLog(**log_entry))
    # db_session.commit()
    
    logger.info(
        f"Wound inference logged: Patient={patient_id} | "
        f"Grade={wagner_grade} | Confidence={confidence:.3f}"
    )


# Startup hook for model preloading

async def preload_wound_model():
    """
    Preload wound severity model at application startup.
    
    Call this from FastAPI lifespan event.
    """
    try:
        logger.info("Preloading wound severity model...")
        get_wound_inference_api()
        logger.info("Wound severity model preloaded successfully ✓")
    except Exception as e:
        logger.warning(f"Failed to preload wound model: {e}")
        logger.warning("Model will be loaded on first request")


