import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc

from backend.database.session import get_db
from backend.database.models import (
    AshaWorker, Patient, AshaPatientAssignment, Screening,
    Commission, AshaCommission, AshaTrainingModule, WoundSite, Consultation
)
from backend.api.middleware import get_current_asha
from backend.utils.legacy_response import success, error, paginated
from backend.utils.validators import sanitise_string, validate_age, validate_gender, validate_phone
from backend.database.schedule_generator import seed_skin_and_contributing_schedules_if_needed, seed_wound_schedules_for_site

router = APIRouter(prefix="/api/v1/asha", tags=["asha"])


def _month_start_utc(dt: datetime):
    return datetime(dt.year, dt.month, 1, tzinfo=timezone.utc)


def _normalize_gender(raw) -> str:
    gtxt = sanitise_string(str(raw or "Other"))
    if not gtxt:
        return "Other"
    low = gtxt.lower()
    if low in ("male", "m"):
        return "Male"
    if low in ("female", "f"):
        return "Female"
    if validate_gender(gtxt):
        return gtxt
    return "Other"


@router.post("/patients")
async def sync_asha_patient(request: Request, db: Session = Depends(get_db)):
    """Offline-first ASHA patient roster sync."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    name = sanitise_string(data.get("name") or data.get("full_name"))
    phone = str(data.get("phone") or data.get("phone_number") or "").strip()
    age_raw = data.get("age")
    location = sanitise_string(
        data.get("location") or data.get("village") or data.get("address") or ""
    )
    created_by = sanitise_string(
        str(data.get("created_by") or data.get("created_by_asha_id") or "")
    )

    if not name:
        return error("validation_error", "name is required", status=400)
    if not validate_phone(phone):
        return error("validation_error", "phone must be exactly 10 digits", status=400)
    if not validate_age(age_raw):
        return error("validation_error", "age must be between 1 and 120", status=400)

    age = int(age_raw)
    gender = _normalize_gender(data.get("gender"))
    village = location or "Unknown"
    
    worker = None
    if created_by:
        worker = db.query(AshaWorker).filter(
            or_(
                AshaWorker.worker_id == created_by.lower(),
                AshaWorker.worker_id == created_by
            )
        ).first()
        if not worker:
            return error("validation_error", "created_by ASHA worker not found", status=400)

    existing = db.query(Patient).filter_by(phone=phone).first()
    if existing:
        existing.name = name
        existing.age = age
        existing.gender = gender
        existing.village = village
        if worker:
            existing.created_by_asha_id = worker.worker_id
        patient = existing
        message = "Patient updated"
        status_code = 200
    else:
        patient = Patient(
            patient_id=uuid.uuid4(),
            name=name,
            phone=phone,
            age=age,
            gender=gender,
            village=village,
            district="Unknown",
            created_by_asha_id=worker.worker_id if worker else None,
            is_research_participant=True,
        )
        db.add(patient)
        message = "Patient created"
        status_code = 201

    db.flush()

    if worker:
        assign = db.query(AshaPatientAssignment).filter_by(
            asha_worker_id=worker.worker_id, patient_id=patient.patient_id
        ).first()
        if assign is None:
            db.add(
                AshaPatientAssignment(
                    assignment_id=uuid.uuid4(),
                    asha_worker_id=worker.worker_id,
                    patient_id=patient.patient_id,
                )
            )

    db.commit()
    return success(
        {"patient_id": str(patient.patient_id), "synced": True},
        status=status_code,
        message=message,
    )


@router.get("/me/dashboard")
async def asha_dashboard(worker: AshaWorker = Depends(get_current_asha), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    month_start = _month_start_utc(now)

    screenings_today = db.query(Screening).filter(
        Screening.asha_id == worker.worker_id,
        Screening.created_at >= today_start,
    ).count()

    screenings_month = db.query(Screening).filter(
        Screening.asha_id == worker.worker_id,
        Screening.created_at >= month_start,
    ).count()

    commission_month = (
        db.query(func.coalesce(func.sum(Commission.amount), 0.0))
        .filter(Commission.asha_id == worker.worker_id, Commission.created_at >= month_start)
        .scalar()
    )

    recent = (
        db.query(Screening)
        .filter_by(asha_id=worker.worker_id)
        .order_by(desc(Screening.created_at))
        .limit(10)
        .all()
    )
    
    recent_out = []
    for s in recent:
        first = (s.patient.name or "").split(" ")[0] if s.patient else ""
        recent_out.append(
            {
                "patient_first_name": first,
                "condition_type": s.condition_type,
                "risk_level": s.risk_level,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
        )

    return success(
        {
            "screenings_today": screenings_today,
            "screenings_month": screenings_month,
            "commission_month": float(commission_month or 0),
            "commission_balance": float(getattr(worker, "commission_balance", 0.0) or 0.0),
            "recent_screenings": recent_out,
        }
    )


@router.get("/me/screenings")
async def asha_screenings(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1),
    worker: AshaWorker = Depends(get_current_asha),
    db: Session = Depends(get_db)
):
    q = db.query(Screening).filter_by(asha_id=worker.worker_id).order_by(desc(Screening.created_at))
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    
    out = []
    for s in items:
        cons = db.query(Consultation).filter_by(screening_id=s.id).first()
        first = (s.patient.name or "").split(" ")[0] if s.patient else ""
        out.append(
            {
                "id": str(s.id),
                "patient_first_name": first,
                "condition_type": s.condition_type,
                "risk_level": s.risk_level,
                "consultation_status": cons.status if cons else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
        )
    return paginated(out, total, page, per_page)


@router.get("/me/commissions")
async def asha_commissions(worker: AshaWorker = Depends(get_current_asha), db: Session = Depends(get_db)):
    items = (
        db.query(Commission)
        .filter_by(asha_id=worker.worker_id)
        .order_by(desc(Commission.created_at))
        .all()
    )
    
    out = []
    total_paid = 0.0
    total_pending = 0.0
    for c in items:
        row = {
            "amount": c.amount,
            "type": c.commission_type,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "paid_at": c.paid_at.isoformat() if c.paid_at else None,
        }
        out.append(row)
        if c.paid_at:
            total_paid += float(c.amount)
        else:
            total_pending += float(c.amount)
            
    return success({"items": out, "total_paid": total_paid, "total_pending": total_pending})


_TRAINING_SPECS = (
    ("MODULE_WOUND_IMAGING", "Wound photography basics"),
    ("MODULE_COIN_PLACEMENT", "Coin placement for scale"),
)


def _ensure_training_modules(db: Session, asha_id: str) -> None:
    for code, _ in _TRAINING_SPECS:
        row = db.query(AshaTrainingModule).filter_by(asha_id=asha_id, module_code=code).first()
        if row is None:
            db.add(
                AshaTrainingModule(
                    module_id=uuid.uuid4(),
                    asha_id=asha_id,
                    module_code=code,
                    passed=False,
                    attempts=0
                )
            )
    db.commit()


@router.get("/me/patients/search")
async def asha_patients_search(
    q: str = Query("", min_length=2),
    worker: AshaWorker = Depends(get_current_asha),
    db: Session = Depends(get_db)
):
    q_raw = q.strip()
    if len(q_raw) < 2:
        return success({"items": []})
        
    like = f"%{q_raw}%"
    assigned_pids = [
        r.patient_id
        for r in db.query(AshaPatientAssignment).filter_by(asha_worker_id=worker.worker_id).all()
    ]
    
    qbase = db.query(Patient)
    if assigned_pids:
        qbase = qbase.filter(Patient.patient_id.in_(assigned_pids))
        
    items = (
        qbase.filter(
            or_(
                Patient.phone.contains(q_raw),
                Patient.name.ilike(like),
                Patient.village.ilike(like),
            )
        )
        .order_by(Patient.name.asc())
        .limit(25)
        .all()
    )
    
    out = [
        {
            "id": str(p.patient_id),
            "name": p.name,
            "phone": p.phone,
            "village": p.village,
            "age": p.age,
            "gender": p.gender,
        }
        for p in items
    ]
    return success({"items": out})


@router.post("/patients/{patient_id}/wound-sites")
async def asha_patient_wound_site_post(
    patient_id: str,
    request: Request,
    worker: AshaWorker = Depends(get_current_asha),
    db: Session = Depends(get_db)
):
    try:
        p_uuid = uuid.UUID(patient_id)
    except ValueError:
        return error("validation_error", "Invalid patient_id UUID", status=400)

    p = db.query(Patient).filter_by(patient_id=p_uuid).first()
    if not p:
        return error("not_found", "Patient not found", status=404)
        
    try:
        data = await request.json()
    except Exception:
        data = {}

    foot_side = sanitise_string(str(data.get("foot_side", "")))
    location_on_foot = sanitise_string(str(data.get("location_on_foot", "")))
    first_detected_date = sanitise_string(str(data.get("first_detected_date", "")))
    if not foot_side or not location_on_foot or not first_detected_date:
        return error(
            "validation_error",
            "foot_side, location_on_foot, and first_detected_date are required",
            status=400,
        )
        
    toe = data.get("toe_number")
    toe_i = int(toe) if toe is not None and str(toe).strip() != "" else None
    
    w = WoundSite(
        wound_site_id=uuid.uuid4(),
        patient_id=p.patient_id,
        location_code=f"{foot_side} - {location_on_foot}",
        initial_date=datetime.now(timezone.utc),
        foot_side=foot_side,
        location_on_foot=location_on_foot,
        toe_number=toe_i,
        first_detected_date=first_detected_date,
        status="ACTIVE",
        notes=sanitise_string(str(data.get("notes", ""))) or None,
        is_primary_site=bool(data.get("is_primary_site", True)),
    )
    db.add(w)
    db.flush()
    
    seed_wound_schedules_for_site(db, str(p.patient_id), str(w.wound_site_id))
    seed_skin_and_contributing_schedules_if_needed(db, str(p.patient_id))
    db.commit()
    
    return success(
        {
            "wound_site": {
                "id": str(w.wound_site_id),
                "foot_side": w.foot_side,
                "location_on_foot": w.location_on_foot,
                "patient_id": str(p.patient_id),
            }
        },
        status=201,
    )


@router.get("/me/training")
async def asha_training_status(worker: AshaWorker = Depends(get_current_asha), db: Session = Depends(get_db)):
    _ensure_training_modules(db, worker.worker_id)
    rows = db.query(AshaTrainingModule).filter_by(asha_id=worker.worker_id).order_by(AshaTrainingModule.module_code).all()
    
    modules = []
    for r in rows:
        title = dict(_TRAINING_SPECS).get(r.module_code, r.module_code)
        modules.append(
            {
                "module_code": r.module_code,
                "title": title,
                "passed": bool(r.passed),
                "score": r.score,
                "attempts": r.attempts or 0,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
        )
    all_passed = all(m["passed"] for m in modules) if modules else True
    return success({"modules": modules, "all_passed": all_passed})


@router.post("/me/training/complete")
async def asha_training_complete(
    request: Request,
    worker: AshaWorker = Depends(get_current_asha),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    code = sanitise_string(str(data.get("module_code", "")))
    if not code:
        return error("validation_error", "module_code is required", status=400)
        
    _ensure_training_modules(db, worker.worker_id)
    row = db.query(AshaTrainingModule).filter_by(asha_id=worker.worker_id, module_code=code).first()
    if not row:
        return error("not_found", "Unknown module_code", status=404)
        
    score = data.get("score")
    row.passed = True
    row.score = float(score) if score is not None else 100.0
    row.attempts = int(row.attempts or 0) + 1
    row.completed_at = datetime.now(timezone.utc)
    db.commit()
    
    return success({"module_code": code, "passed": True})


@router.get("/me/offline-queue")
async def asha_offline_queue_stub(worker: AshaWorker = Depends(get_current_asha)):
    """Phase C6 — offline upload queue (stub)."""
    return success(
        {
            "items": [],
            "pending_uploads": 0,
            "message": "No pending offline items (stub).",
        }
    )


@router.get("/me/enrollment-summary")
async def asha_enrollment_summary(worker: AshaWorker = Depends(get_current_asha), db: Session = Depends(get_db)):
    """Phase C6 — enrollment snapshot."""
    n = db.query(AshaPatientAssignment).filter_by(asha_worker_id=worker.worker_id).count()
    return success({"assigned_patients": n, "geographic_verified_pending": 0})


@router.get("/me/commission-dashboard")
async def asha_commission_dashboard(worker: AshaWorker = Depends(get_current_asha), db: Session = Depends(get_db)):
    """Phase C6 — ledger + balance."""
    rows = (
        db.query(AshaCommission)
        .filter_by(asha_worker_id=worker.worker_id)
        .order_by(desc(AshaCommission.created_at))
        .limit(40)
        .all()
    )
    
    # Deriving summary numbers
    pending_total = 0.0  # Derived as 0 in new model or filter pending periods
    items = [
        {
            "id": str(r.commission_id),
            "amount_rs": r.amount,
            "commission_type": "screening",
            "payment_status": "PAID" if r.created_at else "PENDING",
            "earned_at": r.created_at.isoformat() if r.created_at else None,
            "session_id": None,
        }
        for r in rows
    ]
    
    return success(
        {
            "commission_balance": float(getattr(worker, "commission_balance", 0.0) or 0.0),
            "pending_rs": float(pending_total),
            "items": items,
        }
    )
