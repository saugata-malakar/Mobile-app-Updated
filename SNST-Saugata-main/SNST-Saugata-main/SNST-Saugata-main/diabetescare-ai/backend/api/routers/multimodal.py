"""
Multimodal AI Analysis API Router
Part 10 Deliverable — Saugata Malakar

Combines base64 wound photograph + clinical metadata and calls
Gemini 1.5 Pro to return structured assessments.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import uuid
from sqlalchemy.orm import Session

from ml.multimodal.gemini_multimodal import (
    GeminiMultimodalAPI,
    GeminiWoundAssessment,
    create_gemini_api
)
from backend.database.session import get_db
from backend.database.models import MultimodalAnalysis, Patient, MonitoringSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/multimodal", tags=["multimodal"])


class MultimodalAnalyzeRequest(BaseModel):
    """Request bundle containing base64 photograph + patient metadata."""
    image_base64: str = Field(..., description="Base64-encoded wound photograph (JPEG/PNG)")
    patient_id: str = Field(..., description="Patient UUID")
    session_id: Optional[str] = Field(None, description="Monitoring session UUID")
    hba1c: float = Field(..., ge=4.0, le=15.0, description="HbA1c level (%)")
    diabetes_duration_years: int = Field(..., ge=0, le=60, description="Years with diabetes")
    systolic_bp: int = Field(..., ge=70, le=250, description="Systolic BP (mmHg)")
    diastolic_bp: int = Field(..., ge=40, le=150, description="Diastolic BP (mmHg)")

    class Config:
        json_schema_extra = {
            "example": {
                "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
                "patient_id": "123e4567-e89b-12d3-a456-426614174000",
                "session_id": "223e4567-e89b-12d3-a456-426614174001",
                "hba1c": 9.2,
                "diabetes_duration_years": 12,
                "systolic_bp": 145,
                "diastolic_bp": 92
            }
        }


# Dependency: Get Gemini API instance
def get_gemini_api() -> GeminiMultimodalAPI:
    """Dependency to retrieve configured Gemini Multimodal API instance."""
    return create_gemini_api()


@router.post("/analyze", response_model=GeminiWoundAssessment)
async def analyze_multimodal(
    request: MultimodalAnalyzeRequest,
    gemini_api: GeminiMultimodalAPI = Depends(get_gemini_api),
    db: Session = Depends(get_db)
):
    """
    Perform multimodal wound clinical assessment using Gemini 1.5 Pro.
    
    **Inputs:**
    - image_base64: Base64-encoded wound photograph
    - patient_id: Patient UUID
    - session_id: Optional monitoring session UUID
    - hba1c: HbA1c level (%)
    - diabetes_duration_years: Years with diabetes
    - systolic_bp: Systolic BP
    - diastolic_bp: Diastolic BP
    
    **Outputs:**
    - wound_severity_assessment: Detailed Wagner grade classification
    - confidence_level: low, medium, or high
    - recommended_action: Immediate recommended actions
    - clinical_flags: List of clinical flags (e.g. infection risk, gangrene)
    """
    try:
        logger.info(f"Processing multimodal JSON request for patient {request.patient_id}")
        
        # Build metadata dictionary
        metadata = {
            "hba1c": request.hba1c,
            "diabetes_duration_years": request.diabetes_duration_years,
            "systolic_bp": request.systolic_bp,
            "diastolic_bp": request.diastolic_bp
        }
        
        # Call Gemini API wrapper
        result: GeminiWoundAssessment = await gemini_api.analyze_base64_and_metadata(
            base64_image=request.image_base64,
            metadata=metadata
        )
        
        # Parse UUIDs
        try:
            patient_uuid = uuid.UUID(request.patient_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid patient_id UUID format")
            
        # Parse or generate session UUID
        session_uuid = None
        if request.session_id:
            try:
                session_uuid = uuid.UUID(request.session_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid session_id UUID format")
        
        # Save to database if patient and session exist (or use generated fallback session)
        try:
            # Check patient existence
            patient_exists = db.query(Patient).filter(Patient.patient_id == patient_uuid).first()
            if patient_exists:
                # If session_uuid is not provided or doesn't exist, retrieve or create a mock session
                if not session_uuid:
                    session = db.query(MonitoringSession).filter(MonitoringSession.patient_id == patient_uuid).first()
                    if session:
                        session_uuid = session.session_id
                    else:
                        # Create a mock session to avoid ForeignKey violation
                        new_session = MonitoringSession(
                            session_id=uuid.uuid4(),
                            patient_id=patient_uuid,
                            created_at=datetime.utcnow()
                        )
                        db.add(new_session)
                        db.commit()
                        session_uuid = new_session.session_id
                
                # Parse rule-based fields from severity assessment for table storage
                # Map confidence string back to float
                conf_val = 0.90 if result.confidence_level == "high" else 0.70 if result.confidence_level == "medium" else 0.40
                
                # Save analysis record
                analysis_record = MultimodalAnalysis(
                    analysis_id=uuid.uuid4(),
                    patient_id=patient_uuid,
                    session_id=session_uuid,
                    hba1c=request.hba1c,
                    diabetes_duration_years=request.diabetes_duration_years,
                    systolic_bp=request.systolic_bp,
                    diastolic_bp=request.diastolic_bp,
                    severity_grade=3 if "grade 3" in result.wound_severity_assessment.lower() else 1,
                    severity_label=result.wound_severity_assessment[:250],
                    confidence=conf_val,
                    tissue_assessment=result.wound_severity_assessment,
                    infection_risk="high" if "high" in result.wound_severity_assessment.lower() else "low",
                    healing_prognosis="poor" if "high" in result.wound_severity_assessment.lower() else "good",
                    clinical_insights=[result.wound_severity_assessment],
                    risk_factors=result.clinical_flags,
                    immediate_actions=[result.recommended_action],
                    follow_up_days=3 if "urgent" in result.recommended_action.lower() else 14,
                    specialist_referral="urgent" in result.recommended_action.lower(),
                    raw_response=json.dumps(result.model_dump()),
                    model_name="gemini-1.5-pro",
                    created_at=datetime.utcnow()
                )
                
                db.add(analysis_record)
                db.commit()
                logger.info(f"✓ Multimodal analysis record persisted to DB: {analysis_record.analysis_id}")
        except Exception as db_err:
            db.rollback()
            logger.warning(f"Could not persist analysis record to DB (possibly mock environment): {db_err}")
            
        return result
        
    except Exception as e:
        logger.error(f"Multimodal analysis endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=f"Multimodal assessment failed: {str(e)}")


@router.get("/health")
async def health_check(gemini_api: GeminiMultimodalAPI = Depends(get_gemini_api)):
    """Check Gemini service status."""
    return {
        "status": "ready" if gemini_api.model else "mock_mode",
        "gemini_available": gemini_api.model is not None,
        "model_name": "gemini-1.5-pro" if gemini_api.model else "mock",
        "message": "Multimodal endpoint is ready"
    }
