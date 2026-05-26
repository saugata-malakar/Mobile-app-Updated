import json
from datetime import datetime, timezone

from flask import Blueprint, g, request

from middleware.auth_middleware import require_auth
from middleware.rate_limiter import limiter
from models import AshaWorker, AuditLog, Screening, db
from utils.photo_handler import compress_base64_photo, photos_to_json_string, validate_photo_data
from utils.response_helper import error, success
from utils.validators import parse_json_object, sanitise_string, validate_condition_type, validate_risk_level

screenings_bp = Blueprint("screenings", __name__)


def _utcnow():
    return datetime.now(timezone.utc)


@screenings_bp.post("")
@require_auth
@limiter.limit("60 per hour")
def create_screening():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Only patients can create screenings", status=403)

    data = request.get_json(silent=True) or {}
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
        asha = AshaWorker.query.get(str(asha_id))
        if not asha:
            return error("validation_error", "Invalid asha_id", status=400)

    patient = g.current_user
    compressed = []
    if photos:
        for p in photos:
            compressed.append(compress_base64_photo(p))
    photo_json = photos_to_json_string(compressed if compressed else None)

    ai_str = None
    if ai_result is not None:
        if isinstance(ai_result, (dict, list)):
            ai_str = json.dumps(ai_result)
        else:
            ai_str = str(ai_result)

    screening = Screening(
        patient_id=patient.id,
        asha_id=asha.id if asha else None,
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
    db.session.add(screening)
    db.session.flush()

    if asha:
        asha.total_screenings = int(asha.total_screenings or 0) + 1

    db.session.add(
        AuditLog(
            user_id=patient.id,
            user_type="patient",
            action="create_screening",
            resource_type="screening",
            resource_id=screening.id,
            ip_address=request.remote_addr,
            status_code=201,
            created_at=_utcnow(),
        )
    )
    db.session.commit()

    return success(
        {
            "screening_id": screening.id,
            "risk_level": screening.risk_level,
            "status": "created",
            "created_at": screening.created_at.isoformat() if screening.created_at else None,
        },
        status=201,
    )


@screenings_bp.get("/<screening_id>")
@require_auth
def get_screening(screening_id):
    s = Screening.query.get(screening_id)
    if not s:
        return error("not_found", "Screening not found", status=404)

    ut = getattr(g, "user_type", None)
    user = g.current_user
    allowed = False
    if ut == "admin":
        allowed = True
    elif ut == "patient" and s.patient_id == user.id:
        allowed = True
    elif ut == "asha_worker" and s.asha_id == user.id:
        allowed = True

    if not allowed:
        return error("forbidden", "Not allowed", status=403)

    ai = parse_json_object(s.ai_result)
    photos = parse_json_object(s.photo_data)
    return success(
        {
            "id": s.id,
            "patient_id": s.patient_id,
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
