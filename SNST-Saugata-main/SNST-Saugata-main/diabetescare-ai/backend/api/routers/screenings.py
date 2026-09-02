import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database.session import get_db
from backend.database.models import AshaWorker, AuditLog, Commission, Screening, Patient, Consultation
from backend.api.middleware import get_current_patient
from backend.utils.photo_handler import compress_base64_photo, photos_to_json_string, validate_photo_data, encrypt_photo_data, decrypt_photo_data
from backend.utils.legacy_response import success, error
from backend.utils.validators import parse_json_object, sanitise_string, validate_condition_type, validate_risk_level

router = APIRouter(prefix="/api/v1/screenings", tags=["screenings"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_screening(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    condition_type = data.get("condition_type")
    risk_level = data.get("risk_level")
    consent_raw = data.get("consent_timestamp")
    photos = data.get("photos")
    notes = data.get("notes")
    ai_result = data.get("ai_result")
    quality_score = data.get("quality_score")
    asha_id = data.get("asha_id")

    if not validate_condition_type(condition_type):
        return error("validation_error", "Invalid condition_type", status=400)
    if not validate_risk_level(risk_level):
        return error("validation_error", "Invalid risk_level", status=400)
    if not consent_raw:
        return error("validation_error", "consent_timestamp required", status=400)
        
    try:
        consent_ts = datetime.fromisoformat(str(consent_raw).replace("Z", "+00:00"))
    except ValueError:
        return error("validation_error", "Invalid consent_timestamp", status=400)

    if photos is not None and not validate_photo_data(photos):
        return error("validation_error", "Invalid photos payload", status=400)

    if quality_score is not None:
        try:
            qs = float(quality_score)
            if qs < 0 or qs > 1:
                raise ValueError
        except (TypeError, ValueError):
            return error("validation_error", "quality_score must be 0..1", status=400)
    else:
        qs = None

    notes_clean = sanitise_string(notes) if notes else None
    if notes_clean and len(notes_clean) > 500:
        return error("validation_error", "notes too long", status=400)

    asha = None
    if asha_id:
        asha = db.query(AshaWorker).filter_by(worker_id=str(asha_id)).first()
        if not asha:
            return error("validation_error", "Invalid asha_id", status=400)

    compressed = []
    if photos:
        for ph in photos:
            comp = compress_base64_photo(ph)
            enc = encrypt_photo_data(comp)
            compressed.append(enc)
    photo_json = photos_to_json_string(compressed if compressed else None)

    ai_str = None
    if ai_result is not None:
        if isinstance(ai_result, (dict, list)):
            ai_str = json.dumps(ai_result)
        else:
            ai_str = str(ai_result)

    screening = Screening(
        patient_id=p.patient_id,
        asha_id=asha.worker_id if asha else None,
        condition_type=condition_type,
        risk_level=risk_level,
        ai_result=ai_str,
        model_source=data.get("model_source"),
        confidence=data.get("confidence"),
        photo_data=photo_json,
        quality_score=qs,
        consent_timestamp=consent_ts,
        notes=notes_clean,
    )
    db.add(screening)
    db.flush()

    if asha:
        comm = Commission(
            asha_id=asha.worker_id,
            screening_id=screening.id,
            amount=15.0,
            commission_type="screening",
        )
        db.add(comm)
        asha.total_screenings = int(asha.total_screenings or 0) + 1
        asha.commission_balance = float(asha.commission_balance or 0) + 15.0

    ip_address = request.client.host if request.client else None
    
    db.add(
        AuditLog(
            user_id=p.patient_id,
            action="create_screening",
            table_name="screenings",
            record_id=uuid.UUID(screening.id),
            timestamp=_utcnow(),
            meta_data={
                "user_type": "patient",
                "ip_address": ip_address,
                "status_code": 201,
            }
        )
    )
    db.commit()

    return success(
        {
            "screening_id": screening.id,
            "risk_level": screening.risk_level,
            "status": "created",
            "created_at": screening.created_at.isoformat() if screening.created_at else None,
        },
        status=201,
    )


@router.get("/{screening_id}")
async def get_screening(
    screening_id: str,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    s = db.query(Screening).filter_by(id=screening_id).first()
    if not s:
        return error("not_found", "Screening not found", status=404)

    # Note: user type is patient since get_current_patient is the security dependency.
    # In legacy route, admins and ASHA workers could also read screenings. Let's allow patient checking.
    if s.patient_id != p.patient_id:
        return error("forbidden", "Not allowed", status=403)

    ai = parse_json_object(s.ai_result)
    photos_raw = parse_json_object(s.photo_data)
    photos = []
    if isinstance(photos_raw, list):
        for ph in photos_raw:
            photos.append(decrypt_photo_data(ph))
    else:
        photos = photos_raw
    return success(
        {
            "id": s.id,
            "patient_id": str(s.patient_id),
            "asha_id": s.asha_id,
            "condition_type": s.condition_type,
            "risk_level": s.risk_level,
            "ai_result": ai,
            "model_source": s.model_source,
            "confidence": s.confidence,
            "photo_data": photos,
            "quality_score": s.quality_score,
            "consent_timestamp": s.consent_timestamp.isoformat() if s.consent_timestamp else None,
            "notes": s.notes,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
    )
