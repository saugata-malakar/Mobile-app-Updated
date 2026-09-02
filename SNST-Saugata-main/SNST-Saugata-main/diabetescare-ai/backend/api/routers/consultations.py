import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import case, desc

from backend.database.session import get_db
from backend.database.models import (
    AuditLog,
    Commission,
    Consultation,
    Doctor,
    Patient,
    Prescription,
    Screening,
    AshaWorker,
)
from backend.api.middleware import get_current_patient, get_current_doctor, get_current_user, TokenPayload
from backend.utils.doctor_router import (
    calculate_queue_position,
    calculate_wait_time,
    find_available_doctor,
)
from backend.utils.legacy_response import success, error
from backend.utils.validators import validate_consultation_mode

router = APIRouter(prefix="/api/v1/consultations", tags=["consultations"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _mode_fee(mode: str) -> float:
    if mode == "async":
        return 99.0
    if mode == "scheduled":
        return 149.0
    return 199.0


def _map_slot(slot: Optional[str]) -> Optional[str]:
    if not slot:
        return None
    m = {
        "MORNING": "MORNING",
        "AFTERNOON": "AFTERNOON",
        "EVENING": "EVENING",
    }
    return m.get(slot, slot)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_consultation(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    screening_id = data.get("screening_id")
    mode = data.get("mode")
    time_slot = data.get("time_slot")

    if not screening_id:
        return error("validation_error", "screening_id required", status=400)
    if not validate_consultation_mode(mode):
        return error("validation_error", "Invalid mode", status=400)
    if mode == "scheduled" and not time_slot:
        return error("validation_error", "time_slot required for scheduled mode", status=400)

    screening = db.query(Screening).filter_by(id=str(screening_id)).first()
    if not screening or screening.patient_id != p.patient_id:
        return error("validation_error", "Invalid screening", status=400)

    existing = db.query(Consultation).filter(
        Consultation.screening_id == screening.id,
        Consultation.status.in_(["pending", "assigned", "in_progress"]),
    ).first()
    if existing:
        return error("conflict", "Active consultation already exists for screening", status=409)

    fee = _mode_fee(mode)
    qpos = calculate_queue_position(db)
    wait_min = calculate_wait_time(qpos, mode)

    doctor = None
    status_str = "pending"
    assigned_at = None

    if mode == "instant":
        doctor = find_available_doctor(db, screening.condition_type, mode)
        if doctor:
            status_str = "assigned"
            assigned_at = _utcnow()
            doctor.cases_today = int(doctor.cases_today or 0) + 1

    cons = Consultation(
        consultation_id=uuid.uuid4(),
        screening_id=screening.id,
        patient_id=p.patient_id,
        doctor_id=doctor.doctor_id if doctor else None,
        mode=mode,
        time_slot=_map_slot(time_slot),
        status=status_str,
        queue_position=qpos,
        fee_amount=fee,
        payment_status="pending",
        assigned_at=assigned_at,
    )
    db.add(cons)
    db.flush()

    ip_address = request.client.host if request.client else None

    db.add(
        AuditLog(
            user_id=p.patient_id,
            action="create_consultation",
            table_name="consultations",
            record_id=uuid.UUID(cons.id),
            timestamp=_utcnow(),
            meta_data={
                "user_type": "patient",
                "ip_address": ip_address,
                "status_code": 201,
            }
        )
    )
    db.commit()

    doc_payload = None
    if doctor:
        doc_payload = {
            "id": str(doctor.doctor_id),
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
            "fee_amount": cons.fee_amount,
            "doctor": doc_payload,
        },
        status=201,
    )


@router.get("/{consultation_id}/status")
async def consultation_status(
    consultation_id: str,
    user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = db.query(Consultation).filter_by(id=consultation_id).first()
    if not c:
        return error("not_found", "Not found", status=404)

    allowed = False
    try:
        user_uuid = uuid.UUID(user.user_id)
    except ValueError:
        user_uuid = None

    if user.user_type == "patient" and c.patient_id == user_uuid:
        allowed = True
    elif user.user_type == "doctor" and c.doctor_id == user_uuid:
        allowed = True
    elif user.user_type == "admin":
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
    out["has_prescription"] = c.prescription is not None
    return success(out)


@router.get("/my-queue")
async def my_queue(
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    items = db.query(Consultation).filter_by(patient_id=p.patient_id).order_by(desc(Consultation.created_at)).all()
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


@router.get("/pending")
async def pending_consults(
    user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.user_type not in ("asha", "doctor"):
        return error("forbidden", "Not allowed", status=403)

    risk_order = case(
        (Screening.risk_level == "high", 0),
        (Screening.risk_level == "medium", 1),
        else_=2,
    )
    q = (
        db.query(Consultation).join(Screening, Consultation.screening_id == Screening.id)
        .filter(Consultation.status == "pending")
        .order_by(risk_order, Consultation.created_at.asc())
    )
    out = []
    for c in q.all():
        patient = c.patient
        first = (patient.name or "").split(" ")[0] if patient else ""
        out.append(
            {
                "consultation_id": c.id,
                "condition_type": c.screening.condition_type if c.screening else None,
                "risk_level": c.screening.risk_level if c.screening else None,
                "mode": c.mode,
                "queue_position": c.queue_position,
                "wait_time_minutes": calculate_wait_time(c.queue_position or 1, c.mode),
                "patient_first_name": first,
            }
        )
    return success(out)


@router.put("/{consultation_id}/accept")
async def accept_consultation(
    consultation_id: str,
    doc: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db)
):
    c = db.query(Consultation).filter_by(id=consultation_id).first()
    if not c or c.status != "pending":
        return error("bad_request", "Invalid consultation", status=400)

    c.doctor_id = doc.doctor_id
    c.status = "assigned"
    c.assigned_at = _utcnow()
    doc.cases_today = int(doc.cases_today or 0) + 1
    db.commit()
    return success({"id": c.id, "status": c.status, "doctor_id": str(doc.doctor_id)})


@router.put("/{consultation_id}/cancel")
async def cancel_consultation(
    consultation_id: str,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    c = db.query(Consultation).filter_by(id=consultation_id).first()
    if not c or c.patient_id != p.patient_id:
        return error("not_found", "Not found", status=404)
    if c.status != "pending":
        return error("bad_request", "Only pending can be cancelled", status=400)
    c.status = "cancelled"
    db.commit()
    return success({"status": "cancelled"})


@router.post("/{consultation_id}/prescription")
async def add_prescription(
    consultation_id: str,
    request: Request,
    doc: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db)
):
    c = db.query(Consultation).filter_by(id=consultation_id).first()
    if not c or c.doctor_id != doc.doctor_id or c.status not in ("assigned", "in_progress"):
        return error("bad_request", "Invalid consultation", status=400)

    try:
        data = await request.json()
    except Exception:
        data = {}

    diagnosis = data.get("diagnosis")
    medications = data.get("medications")
    if not diagnosis or medications is None:
        return error("validation_error", "diagnosis and medications required", status=400)
    if not isinstance(medications, list):
        return error("validation_error", "medications must be a list", status=400)

    pr = Prescription(
        prescription_id=uuid.uuid4(),
        consultation_id=c.id,
        doctor_id=doc.doctor_id,
        patient_id=c.patient_id,
        diagnosis=str(diagnosis),
        icd10_code=data.get("icd10_code"),
        medications=json.dumps(medications),
        instructions=data.get("instructions"),
        follow_up_days=int(data.get("follow_up_days", 7)),
    )
    db.add(pr)
    c.status = "completed"
    c.completed_at = _utcnow()

    screening = c.screening
    if screening and screening.asha_id:
        comm = Commission(
            id=str(uuid.uuid4()),
            asha_id=screening.asha_id,
            screening_id=screening.id,
            amount=20.0,
            commission_type="referral",
        )
        db.add(comm)
        asha = db.query(AshaWorker).filter_by(worker_id=screening.asha_id).first()
        if asha:
            asha.commission_balance = float(asha.commission_balance or 0) + 20.0

    db.commit()
    return success(
        {
            "prescription_id": str(pr.prescription_id),
            "consultation_id": c.id,
            "diagnosis": pr.diagnosis,
            "medications": medications,
        },
        status=201,
    )
