import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import ConsentVersion, Patient, User
from backend.api.dependencies import get_current_user

router = APIRouter()

# Platform-level minimum required version (bump this env var to trigger re-consent)
PLATFORM_CONSENT_VERSION = int(os.getenv("PLATFORM_CONSENT_VERSION", "1"))


# ── Schemas ───────────────────────────────────────────────────────────────────
class ConsentRecordRequest(BaseModel):
    patient_id:     str
    consent_stage:  int
    data_use_scope: Dict[str, Any]

    @field_validator("consent_stage")
    @classmethod
    def stage_must_be_1_or_2(cls, v):
        if v not in (1, 2):
            raise ValueError("consent_stage must be 1 or 2")
        return v

    @field_validator("data_use_scope")
    @classmethod
    def scope_must_not_be_empty(cls, v):
        if not v:
            raise ValueError("data_use_scope must not be empty")
        return v


class ConsentRecordResponse(BaseModel):
    consent_id:    str
    patient_id:    str
    consent_stage: int
    version:       int
    is_current:    bool
    consented_at:  datetime


class PendingReconsentItem(BaseModel):
    patient_id:    str
    consent_stage: int
    current_version: int
    required_version: int


# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_current_version(db: Session, patient_id: str, stage: int) -> Optional[ConsentVersion]:
    return (
        db.query(ConsentVersion)
        .filter(
            ConsentVersion.patient_id   == patient_id,
            ConsentVersion.consent_stage == stage,
            ConsentVersion.is_current    == True,
        )
        .first()
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/record", status_code=status.HTTP_201_CREATED, response_model=ConsentRecordResponse)
def record_consent(
    payload: ConsentRecordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    existing = _get_current_version(db, payload.patient_id, payload.consent_stage)

    if existing:
        # ── Version bump: mark old row inactive (use raw UPDATE to bypass immutability listener)
        db.execute(
            ConsentVersion.__table__.update()
            .where(ConsentVersion.consent_id == existing.consent_id)
            .values(is_current=False)
        )
        db.flush()
        new_version = existing.version + 1
    else:
        new_version = 1

    new_consent = ConsentVersion(
        patient_id     = payload.patient_id,
        consent_stage  = payload.consent_stage,
        version        = new_version,
        consented_at   = datetime.utcnow(),
        data_use_scope = payload.data_use_scope,
        is_current     = True,
    )
    db.add(new_consent)
    db.commit()
    db.refresh(new_consent)

    return ConsentRecordResponse(
        consent_id    = str(new_consent.consent_id),
        patient_id    = str(new_consent.patient_id),
        consent_stage = new_consent.consent_stage,
        version       = new_consent.version,
        is_current    = new_consent.is_current,
        consented_at  = new_consent.consented_at,
    )


@router.get("/pending-reconsent", response_model=List[PendingReconsentItem])
def pending_reconsent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns every (patient, stage) pair where the patient's current
    consent version is below PLATFORM_CONSENT_VERSION.
    """
    rows = (
        db.query(ConsentVersion)
        .filter(
            ConsentVersion.is_current == True,
            ConsentVersion.version    <  PLATFORM_CONSENT_VERSION,
        )
        .all()
    )
    return [
        PendingReconsentItem(
            patient_id       = str(r.patient_id),
            consent_stage    = r.consent_stage,
            current_version  = r.version,
            required_version = PLATFORM_CONSENT_VERSION,
        )
        for r in rows
    ]
