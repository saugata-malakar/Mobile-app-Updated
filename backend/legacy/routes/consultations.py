import json
from datetime import datetime, timezone

from flask import Blueprint, g, request
from sqlalchemy import case

from middleware.auth_middleware import require_auth, require_doctor, require_asha
from middleware.rate_limiter import limiter
from models import (
    AuditLog,
    Consultation,
    Doctor,
    Patient,
    Prescription,
    Screening,
    db,
)
from utils.doctor_router import (
    calculate_queue_position,
    calculate_wait_time,
    find_available_doctor,
)
from utils.response_helper import error, success
from utils.validators import validate_consultation_mode

consultations_bp = Blueprint("consultations", __name__)


def _utcnow():
    return datetime.now(timezone.utc)


def _map_slot(slot: str | None) -> str | None:
    if not slot:
        return None
    m = {
        "MORNING": "MORNING",
        "AFTERNOON": "AFTERNOON",
        "EVENING": "EVENING",
    }
    return m.get(slot, slot)


@consultations_bp.post("")
@require_auth
@limiter.limit("20 per hour")
def create_consultation():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Only patients can request consultations", status=403)

    data = request.get_json(silent=True) or {}
    screening_id = data.get("screening_id")
    mode = data.get("mode")
    time_slot = data.get("time_slot")

    if not screening_id:
        return error("validation_error", "screening_id required", status=400)
    if not validate_consultation_mode(mode):
        return error("validation_error", "Invalid mode", status=400)
    if mode == "scheduled" and not time_slot:
        return error("validation_error", "time_slot required for scheduled mode", status=400)

    patient = g.current_user
    screening = Screening.query.get(str(screening_id))
    if not screening or screening.patient_id != patient.id:
        return error("validation_error", "Invalid screening", status=400)

    existing = Consultation.query.filter(
        Consultation.screening_id == screening.id,
        Consultation.status.in_(["pending", "assigned", "in_progress"]),
    ).first()
    if existing:
        return error("conflict", "Active consultation already exists for screening", status=409)

    qpos = calculate_queue_position()
    wait_min = calculate_wait_time(qpos, mode)

    doctor = None
    status = "pending"
    assigned_at = None
    doctor_id = None

    if mode == "instant":
        doctor = find_available_doctor(screening.condition_type, mode)
        if doctor:
            status = "assigned"
            assigned_at = _utcnow()
            doctor_id = doctor.id
            doctor.cases_today = int(doctor.cases_today or 0) + 1

    cons = Consultation(
        screening_id=screening.id,
        patient_id=patient.id,
        doctor_id=doctor_id,
        mode=mode,
        time_slot=_map_slot(time_slot),
        status=status,
        queue_position=qpos,
        assigned_at=assigned_at,
    )
    db.session.add(cons)
    db.session.flush()

    db.session.add(
        AuditLog(
            user_id=patient.id,
            user_type="patient",
            action="create_consultation",
            resource_type="consultation",
            resource_id=cons.id,
            ip_address=request.remote_addr,
            status_code=201,
            created_at=_utcnow(),
        )
    )
    db.session.commit()

    doc_payload = None
    if doctor:
        doc_payload = {
            "id": doctor.id,
            "name": doctor.name,
            "specialisation": doctor.specialisation,
            "languages": doctor.languages,
        }

    return success(
        {
            "consultation_id": cons.id,
            "status": cons.status,
            "queue_position": cons.queue_position,
            "estimated_wait_minutes": wait_min,
            "doctor": doc_payload,
        },
        status=201,
    )


@consultations_bp.get("/<consultation_id>/status")
@require_auth
def consultation_status(consultation_id):
    c = Consultation.query.get(consultation_id)
    if not c:
        return error("not_found", "Not found", status=404)
    ut = getattr(g, "user_type", None)
    user = g.current_user
    allowed = False
    if ut == "patient" and c.patient_id == user.id:
        allowed = True
    elif ut == "doctor" and c.doctor_id == user.id:
        allowed = True
    elif ut == "admin":
        allowed = True
    if not allowed:
        return error("forbidden", "Not allowed", status=403)

    wait = calculate_wait_time(c.queue_position or 1, c.mode)
    out = {
        "status": c.status,
        "queue_position": c.queue_position,
        "estimated_wait_minutes": wait,
    }
    if c.doctor:
        out["doctor"] = {
            "name": c.doctor.name,
            "specialisation": c.doctor.specialisation,
            "languages": c.doctor.languages,
        }
    if c.status == "completed":
        out["has_prescription"] = c.prescription is not None
    return success(out)


@consultations_bp.get("/my-queue")
@require_auth
def my_queue():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Patients only", status=403)
    p = g.current_user
    items = p.consultations.order_by(Consultation.created_at.desc()).all()
    out = []
    for c in items:
        out.append(
            {
                "id": c.id,
                "status": c.status,
                "mode": c.mode,
                "queue_position": c.queue_position,
                "doctor": {"name": c.doctor.name} if c.doctor else None,
            }
        )
    return success(out)


@consultations_bp.get("/pending")
@require_auth
def pending_consults():
    ut = getattr(g, "user_type", None)
    if ut not in ("asha_worker", "doctor"):
        return error("forbidden", "Not allowed", status=403)

    risk_order = case(
        (Screening.risk_level == "high", 0),
        (Screening.risk_level == "medium", 1),
        else_=2,
    )
    q = (
        Consultation.query.join(Screening)
        .join(Patient)
        .filter(Consultation.status == "pending")
        .order_by(risk_order, Consultation.created_at.asc())
    )
    out = []
    for c in q.all():
        patient: Patient = c.patient
        first = (patient.name or "").split(" ")[0]
        out.append(
            {
                "consultation_id": c.id,
                "condition_type": c.screening.condition_type,
                "risk_level": c.screening.risk_level,
                "mode": c.mode,
                "queue_position": c.queue_position,
                "wait_time_minutes": calculate_wait_time(c.queue_position or 1, c.mode),
                "patient_first_name": first,
            }
        )
    return success(out)


@consultations_bp.put("/<consultation_id>/accept")
@require_doctor
def accept_consultation(consultation_id):
    doc: Doctor = g.current_user
    c = Consultation.query.get(consultation_id)
    if not c or c.status != "pending":
        return error("bad_request", "Invalid consultation", status=400)

    c.doctor_id = doc.id
    c.status = "assigned"
    c.assigned_at = _utcnow()
    doc.cases_today = int(doc.cases_today or 0) + 1
    db.session.commit()
    return success({"id": c.id, "status": c.status, "doctor_id": doc.id})


@consultations_bp.put("/<consultation_id>/cancel")
@require_auth
def cancel_consultation(consultation_id):
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Only patient can cancel", status=403)
    c = Consultation.query.get(consultation_id)
    if not c or c.patient_id != g.current_user.id:
        return error("not_found", "Not found", status=404)
    if c.status != "pending":
        return error("bad_request", "Only pending can be cancelled", status=400)
    c.status = "cancelled"
    db.session.commit()
    return success({"status": "cancelled"})


@consultations_bp.post("/<consultation_id>/prescription")
@require_doctor
def add_prescription(consultation_id):
    doc: Doctor = g.current_user
    c = Consultation.query.get(consultation_id)
    if not c or c.doctor_id != doc.id or c.status not in ("assigned", "in_progress"):
        return error("bad_request", "Invalid consultation", status=400)

    data = request.get_json(silent=True) or {}
    diagnosis = data.get("diagnosis")
    medications = data.get("medications")
    if not diagnosis or medications is None:
        return error("validation_error", "diagnosis and medications required", status=400)
    if not isinstance(medications, list):
        return error("validation_error", "medications must be a list", status=400)

    pr = Prescription(
        consultation_id=c.id,
        doctor_id=doc.id,
        patient_id=c.patient_id,
        diagnosis=str(diagnosis),
        icd10_code=data.get("icd10_code"),
        medications=json.dumps(medications),
        instructions=data.get("instructions"),
        follow_up_days=int(data.get("follow_up_days", 7)),
    )
    db.session.add(pr)
    c.status = "completed"
    c.completed_at = _utcnow()

    db.session.commit()
    return success(
        {
            "prescription_id": pr.id,
            "consultation_id": c.id,
            "diagnosis": pr.diagnosis,
            "medications": medications,
        },
        status=201,
    )
