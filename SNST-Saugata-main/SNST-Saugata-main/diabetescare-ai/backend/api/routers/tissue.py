"""
Wound Tissue Classification API Endpoint
Week 3 - Sharif's Implementation

REST API: POST /api/v1/wound/tissue
REST API: POST /api/v1/wound/periwound
REST API: POST /api/v1/wound/combined

Integrates with existing wound severity endpoint.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging
import io
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/wound", tags=["wound-tissue"])

# Global inference API instance
_tissue_inference_api = None


def get_tissue_inference_api():
    """Get or initialize tissue inference API."""
    global _tissue_inference_api
    
    if _tissue_inference_api is None:
        try:
            from ml.wound_tissue.inference import TissueInferenceAPI
            from backend.utils.config import settings
            
            # Try to load models if they exist
            tissue_model_path = settings.WOUND_TISSUE_MODEL_PATH
            periwound_model_path = settings.PERIWOUND_MODEL_PATH
            
            _tissue_inference_api = TissueInferenceAPI(
                tissue_model_path=tissue_model_path if tissue_model_path else None,
                periwound_model_path=periwound_model_path if periwound_model_path else None
            )
            
            logger.info("Tissue inference API initialized")
            
        except Exception as e:
            logger.warning(f"Could not initialize tissue inference API: {e}")
            _tissue_inference_api = None
    
    return _tissue_inference_api


# Request/Response Models

class TissueClassificationResponse(BaseModel):
    """Tissue classification response."""
    status: str = "success"
    class_id: int
    class_name: str
    description: str
    confidence: float
    severity: str
    recommendations: List[str]
    probabilities: Dict[str, float]
    processing_time_ms: float
    timestamp: str


class PeriwoundResponse(BaseModel):
    """Periwound classification response."""
    status: str = "success"
    class_id: int
    class_name: str
    is_redness: bool
    confidence: float
    processing_time_ms: float
    timestamp: str


class CombinedWoundResponse(BaseModel):
    """Combined wound analysis response."""
    status: str = "success"
    tissue_classification: Dict[str, Any]
    periwound_detection: Dict[str, Any]
    cellulitis_indicator: bool
    severity_assessment: Dict[str, Any]
    recommendations: List[str]
    processing_time_ms: float
    timestamp: str


# Endpoints

@router.post("/tissue", response_model=TissueClassificationResponse)
async def classify_tissue(
    image: UploadFile = File(..., description="Wound image for tissue classification")
) -> TissueClassificationResponse:
    """
    Classify wound tissue type.
    
    Four tissue classes:
    - Granulation (healthy healing)
    - Slough (stalled healing)
    - Eschar (necrotic tissue)
    - Cellulitis (active infection)
    
    Returns tissue classification with confidence and recommendations.
    """
    import time
    start_time = time.time()
    
    # Validate image
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {image.content_type}. Expected image/jpeg or image/png"
        )
    
    try:
        # Read and process image
        image_data = await image.read()
        pil_image = Image.open(io.BytesIO(image_data))
        
        # Get inference API
        inference_api = get_tissue_inference_api()
        
        if inference_api is None:
            # Return mock response if API not initialized
            logger.warning("Tissue inference API not available, returning mock response")
            return TissueClassificationResponse(
                status="mock",
                class_id=0,
                class_name="Granulation",
                description="Healthy pink/red granulation tissue",
                confidence=0.85,
                severity="low",
                recommendations=[
                    "Continue current wound care",
                    "Maintain moist environment",
                    "Monitor for infection"
                ],
                probabilities={
                    "Granulation": 0.85,
                    "Slough": 0.08,
                    "Eschar": 0.02,
                    "Cellulitis": 0.05
                },
                processing_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow().isoformat()
            )
        
        # Perform inference
        result = inference_api.infer_tissue(pil_image, return_probs=True)
        
        processing_time = (time.time() - start_time) * 1000
        
        return TissueClassificationResponse(
            status=result["status"],
            class_id=result["prediction"]["class_id"],
            class_name=result["prediction"]["class_name"],
            description=result["prediction"]["description"],
            confidence=result["prediction"]["confidence"],
            severity=result["prediction"]["severity"],
            recommendations=result["recommendations"],
            probabilities=result.get("probabilities", {}),
            processing_time_ms=processing_time,
            timestamp=result["timestamp"]
        )
    
    except Exception as e:
        logger.error(f"Tissue classification error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Tissue classification failed: {str(e)}"
        )


@router.post("/periwound", response_model=PeriwoundResponse)
async def classify_periwound(
    image: UploadFile = File(..., description="Wound image for periwound analysis")
) -> PeriwoundResponse:
    """
    Detect periwound redness.
    
    Binary classification:
    - Normal: No spreading redness
    - Periwound Redness: Redness extending beyond wound margin
    
    Important indicator for cellulitis even when wound appears contained.
    """
    import time
    start_time = time.time()
    
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {image.content_type}"
        )
    
    try:
        image_data = await image.read()
        pil_image = Image.open(io.BytesIO(image_data))
        
        inference_api = get_tissue_inference_api()
        
        if inference_api is None:
            # Mock response
            return PeriwoundResponse(
                status="mock",
                class_id=0,
                class_name="Normal",
                is_redness=False,
                confidence=0.90,
                processing_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow().isoformat()
            )
        
        result = inference_api.infer_periwound(pil_image)
        processing_time = (time.time() - start_time) * 1000
        
        return PeriwoundResponse(
            status=result["status"],
            class_id=result["prediction"]["class_id"],
            class_name=result["prediction"]["class_name"],
            is_redness=result["prediction"]["is_redness"],
            confidence=result["prediction"]["confidence"],
            processing_time_ms=processing_time,
            timestamp=result["timestamp"]
        )
    
    except Exception as e:
        logger.error(f"Periwound classification error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Periwound classification failed: {str(e)}"
        )


@router.post("/combined", response_model=CombinedWoundResponse)
async def combined_wound_analysis(
    image: UploadFile = File(..., description="Wound image for complete analysis")
) -> CombinedWoundResponse:
    """
    Complete wound analysis.
    
    Combines:
    1. Tissue classification (4 classes)
    2. Periwound redness detection
    3. Cellulitis indicator
    4. Severity assessment
    5. Clinical recommendations
    """
    import time
    start_time = time.time()
    
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {image.content_type}"
        )
    
    try:
        image_data = await image.read()
        pil_image = Image.open(io.BytesIO(image_data))
        
        inference_api = get_tissue_inference_api()
        
        if inference_api is None:
            # Mock response
            return CombinedWoundResponse(
                status="mock",
                tissue_classification={
                    "class_id": 0,
                    "class_name": "Granulation",
                    "description": "Healthy tissue",
                    "confidence": 0.85,
                    "severity": "low"
                },
                periwound_detection={
                    "class_id": 0,
                    "class_name": "Normal",
                    "is_redness": False,
                    "confidence": 0.90
                },
                cellulitis_indicator=False,
                severity_assessment={
                    "level": "LOW",
                    "score": 1,
                    "description": "Healthy wound with granulation tissue"
                },
                recommendations=[
                    "Continue current wound care",
                    "Monitor for changes"
                ],
                processing_time_ms=(time.time() - start_time) * 1000,
                timestamp=datetime.utcnow().isoformat()
            )
        
        result = inference_api.infer_combined(pil_image)
        processing_time = (time.time() - start_time) * 1000
        
        return CombinedWoundResponse(
            status=result["status"],
            tissue_classification=result["tissue_classification"],
            periwound_detection=result["periwound_detection"],
            cellulitis_indicator=result["cellulitis_indicator"],
            severity_assessment=result["severity_assessment"],
            recommendations=result["recommendations"],
            processing_time_ms=processing_time,
            timestamp=result["timestamp"]
        )
    
    except Exception as e:
        logger.error(f"Combined analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Combined analysis failed: {str(e)}"
        )


@router.get("/tissue/classes")
async def get_tissue_classes() -> Dict[str, Any]:
    """
    Get information about tissue classes.
    
    Returns class descriptions and clinical significance.
    """
    return {
        "classes": [
            {
                "id": 0,
                "name": "Granulation",
                "description": "Healthy pink/red granulation tissue indicating active healing",
                "severity": "low",
                "clinical_significance": "Positive indicator of healing"
            },
            {
                "id": 1,
                "name": "Slough",
                "description": "Yellow fibrinous tissue indicating stalled healing",
                "severity": "moderate",
                "clinical_significance": "Requires debridement, assess for infection"
            },
            {
                "id": 2,
                "name": "Eschar",
                "description": "Black/brown necrotic tissue",
                "severity": "high",
                "clinical_significance": "Urgent debridement required, risk of infection"
            },
            {
                "id": 3,
                "name": "Cellulitis",
                "description": "Active infection with spreading redness",
                "severity": "severe",
                "clinical_significance": "URGENT: Requires antibiotics, possible hospitalization"
            }
        ],
        "periwound": {
            "description": "Redness extending beyond wound margin",
            "significance": "Critical indicator of spreading infection even when wound appears contained"
        }
    }


@router.get("/tissue/model/info")
async def get_tissue_model_info() -> Dict[str, Any]:
    """
    Get tissue classification model information.
    """
    return {
        "model_type": "WoundTissueCNN",
        "architecture": "EfficientNet-B0",
        "num_classes": 4,
        "input_size": [224, 224],
        "training_strategy": {
            "phase1": "Frozen backbone, train head (5 epochs)",
            "phase2": "Fine-tune top 20% (15 epochs)"
        },
        "loss_function": "AsymmetricFocalLoss",
        "target_metrics": {
            "overall_accuracy": "≥85%",
            "cellulitis_sensitivity": "≥90%"
        }
    }