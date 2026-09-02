import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database.session import get_db
from backend.database.models import Alert, Doctor, MonitoringSession, Patient, TeleconsultRequest
from backend.api.middleware import get_current_patient
from backend.utils.legacy_response import success, error
from backend.utils.validators import sanitise_string

router = APIRouter(prefix="/api/v1/teleconsults", tags=["teleconsults"])

ALLOWED_TYPES = frozenset({"URGENT", "ROUTINE", "FOLLOW_UP"})
ACTIVE_STATUSES = frozenset({"PENDING", "ASSIGNED", "SCHEDULED"})
TERMINAL = frozenset({"COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_iso_dt(value: Optional[str]) -> Optional[datetime]:
    if not value or not str(value).strip():
        return None
    s = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _default_scheduled(request_type: str, preferred: Optional[datetime]) -> datetime:
    now = _utcnow()
    if preferred and preferred > now:
        base = preferred
    else:
        if request_type == "URGENT":
            base = now + timedelta(minutes=45)
        elif request_type == "ROUTINE":
            base = now + timedelta(hours=4)
        else:
            base = now + timedelta(hours=24)
    return base


def _pick_doctor(db: Session) -> Optional[Doctor]:
    q = db.query(Doctor).filter_by(active=True).order_by(Doctor.created_at.asc())
    for d in q:
        if getattr(d, "consultation_phone", None):
            return d
    return q.first()


def _parse_prescription(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _serialize(db: Session, tc: TeleconsultRequest, *, detail: bool = False) -> dict:
    doctor = db.query(Doctor).filter_by(doctor_id=tc.assigned_doctor_id).first() if tc.assigned_doctor_id else None
    doctor_name = doctor.name if doctor else None
    doctor_phone = getattr(doctor, "consultation_phone", None) if doctor else None
    now = _utcnow()
    sched = _as_utc(tc.scheduled_at or tc.estimated_callback_at)
    
    can_cancel = False
    if tc.status in ACTIVE_STATUSES and sched:
        seconds = (sched - now).total_seconds()
        can_cancel = seconds > 2 * 3600
    elif tc.status == "PENDING" and not sched:
        can_cancel = True

    row = {
        "id": str(tc.request_id),
        "status": tc.status,
        "request_type": tc.request_type,
        "session_id": tc.session_id,
        "alert_id": tc.alert_id,
        "patient_concern_en": tc.patient_concern_en,
        "patient_concern_bn": tc.patient_concern_bn,
        "preferred_callback_time": tc.preferred_callback_time,
        "estimated_callback_time": tc.estimated_callback_at.isoformat() if tc.estimated_callback_at else None,
        "scheduled_callback_time": tc.scheduled_at.isoformat() if tc.scheduled_at else None,
        "assigned_doctor_name": doctor_name,
        "doctor_calling_number": doctor_phone,
        "can_cancel": can_cancel,
        "requested_at": tc.requested_at.isoformat() if tc.requested_at else None,
        "patient_rating": tc.patient_rating,
        "patient_feedback": tc.patient_feedback,
    }
    if detail:
        row["prescription"] = _parse_prescription(tc.prescription_json)
    return row


@router.post("", status_code=status.HTTP_201_CREATED)
async def post_create(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    request_type = str(data.get("request_type", "")).upper().strip()
    if request_type not in ALLOWED_TYPES:
        return error("validation_error", "request_type must be URGENT, ROUTINE, or FOLLOW_UP", status=400)

    concern_en = sanitise_string(data.get("patient_concern_en")) if data.get("patient_concern_en") else None
    concern_bn = sanitise_string(data.get("patient_concern_bn")) if data.get("patient_concern_bn") else None
    preferred_raw = data.get("preferred_callback_time")
    preferred_iso = str(preferred_raw).strip() if preferred_raw else None
    preferred_dt = _parse_iso_dt(preferred_iso) if preferred_iso else None

    session_id = data.get("session_id")
    alert_id = data.get("alert_id")
    
    if session_id:
        sid = str(session_id).strip()
        try:
            session_uuid = uuid.UUID(sid)
            sess = db.query(MonitoringSession).filter_by(session_id=session_uuid).first()
            if not sess or sess.patient_id != p.patient_id:
                return error("validation_error", "session_id not found for this patient", status=400)
            session_id = sid
        except ValueError:
            return error("validation_error", "Invalid session_id UUID format", status=400)
    else:
        session_id = None

    if alert_id:
        aid = str(alert_id).strip()
        try:
            alert_uuid = uuid.UUID(aid)
            al = db.query(Alert).filter_by(alert_id=alert_uuid).first()
            if not al or al.patient_id != p.patient_id:
                return error("validation_error", "alert_id not found for this patient", status=400)
            alert_id = aid
        except ValueError:
            return error("validation_error", "Invalid alert_id UUID format", status=400)
    else:
        alert_id = None

    scheduled = _default_scheduled(request_type, preferred_dt)
    estimated = scheduled
    doctor = _pick_doctor(db)
    now = _utcnow()

    tc = TeleconsultRequest(
        patient_id=p.patient_id,
        session_id=session_id,
        alert_id=alert_id,
        request_type=request_type,
        patient_concern_en=concern_en,
        patient_concern_bn=concern_bn,
        preferred_callback_time=preferred_iso,
        estimated_callback_at=estimated,
        scheduled_at=scheduled,
        status="SCHEDULED" if doctor else "PENDING",
        assigned_doctor_id=doctor.doctor_id if doctor else None,
        assigned_at=now if doctor else None,
        requested_at=now,
    )
    db.add(tc)
    db.commit()

    return success(
        {
            "teleconsult_id": str(tc.request_id),
            "estimated_callback_time": tc.estimated_callback_at.isoformat() if tc.estimated_callback_at else None,
        },
        status=201,
    )


@router.get("/me")
async def get_mine(
    status_filter: Optional[str] = Query(None, alias="status"),
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    q = db.query(TeleconsultRequest).filter_by(patient_id=p.patient_id).order_by(desc(TeleconsultRequest.requested_at))
    if status_filter:
        q = q.filter_by(status=str(status_filter).upper())
    items = [_serialize(db, r) for r in q.limit(100).all()]
    return success(items)


@router.get("/{tc_id}")
async def get_one(
    tc_id: str,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        tc_uuid = uuid.UUID(tc_id)
    except ValueError:
        return error("validation_error", "Invalid teleconsult ID format", status=400)

    tc = db.query(TeleconsultRequest).filter_by(request_id=tc_uuid).first()
    if not tc or tc.patient_id != p.patient_id:
        return error("not_found", "Teleconsult not found", status=404)
    return success(_serialize(db, tc, detail=True))


@router.put("/{tc_id}/rate")
async def put_rate(
    tc_id: str,
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        tc_uuid = uuid.UUID(tc_id)
    except ValueError:
        return error("validation_error", "Invalid teleconsult ID format", status=400)

    tc = db.query(TeleconsultRequest).filter_by(request_id=tc_uuid).first()
    if not tc or tc.patient_id != p.patient_id:
        return error("not_found", "Teleconsult not found", status=404)
    if tc.status != "COMPLETED":
        return error("validation_error", "Teleconsult must be completed before rating", status=400)
    
    try:
        data = await request.json()
    except Exception:
        data = {}

    rating = data.get("rating")
    try:
        rint = int(rating)
    except (TypeError, ValueError):
        return error("validation_error", "rating must be an integer 1-5", status=400)
    if rint < 1 or rint > 5:
        return error("validation_error", "rating must be between 1 and 5", status=400)
    
    feedback = sanitise_string(data.get("feedback")) if data.get("feedback") else None
    tc.patient_rating = rint
    tc.patient_feedback = feedback
    db.commit()
    return success(None)


@router.post("/{tc_id}/mark-received")
async def post_mark_received(
    tc_id: str,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        tc_uuid = uuid.UUID(tc_id)
    except ValueError:
        return error("validation_error", "Invalid teleconsult ID format", status=400)

    tc = db.query(TeleconsultRequest).filter_by(request_id=tc_uuid).first()
    if not tc or tc.patient_id != p.patient_id:
        return error("not_found", "Teleconsult not found", status=404)
    if tc.status in TERMINAL:
        return error("validation_error", "Teleconsult is already closed", status=400)
    if tc.status not in frozenset({"PENDING", "ASSIGNED", "SCHEDULED"}):
        return error("validation_error", "Invalid status for completion", status=400)

    now = _utcnow()
    sched = _as_utc(tc.scheduled_at or tc.estimated_callback_at)
    if sched and (sched - now) > timedelta(minutes=20):
        return error(
            "validation_error",
            "Scheduled callback has not started yet. Try again closer to your booked time.",
            status=400,
        )

    tc.status = "COMPLETED"
    tc.actual_call_at = now
    db.commit()
    return success({"status": tc.status})


@router.post("/{tc_id}/cancel")
async def post_cancel(
    tc_id: str,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        tc_uuid = uuid.UUID(tc_id)
    except ValueError:
        return error("validation_error", "Invalid teleconsult ID format", status=400)

    tc = db.query(TeleconsultRequest).filter_by(request_id=tc_uuid).first()
    if not tc or tc.patient_id != p.patient_id:
        return error("not_found", "Teleconsult not found", status=404)
    if tc.status in TERMINAL:
        return error("validation_error", "Teleconsult is already closed", status=400)
    
    sched = _as_utc(tc.scheduled_at or tc.estimated_callback_at)
    now = _utcnow()
    if sched:
        if (sched - now).total_seconds() <= 2 * 3600:
            return error(
                "validation_error",
                "Cancellation is only allowed more than 2 hours before the scheduled call.",
                status=400,
            )
            
    tc.status = "CANCELLED"
    tc.cancelled_at = now
    db.commit()
    return success({"status": tc.status})
