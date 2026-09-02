import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, request
from sqlalchemy import func, or_

from middleware.auth_middleware import require_asha
from models import (
    AshaCommissionLedger,
    AshaPatientAssignment,
    AshaTrainingModule,
    AshaWorker,
    Commission,
    Consultation,
    Patient,
    Screening,
    WoundSite,
    db,
)
from utils.response_helper import error, paginated, success
from utils.schedule_generator import seed_skin_and_contributing_schedules_if_needed, seed_wound_schedules_for_site
from utils.validators import sanitise_string, validate_age, validate_gender, validate_phone

asha_bp = Blueprint("asha", __name__)


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


@asha_bp.post("/patients")
def sync_asha_patient():
    """
    Offline-first ASHA patient roster sync (no JWT).
    Accepts mobile patientRemoteSync payload and spec fields: name, phone, age, location, created_by.
    """
    data = request.get_json(silent=True) or {}
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
    asha_id = None
    if created_by:
        worker = AshaWorker.query.filter(
            (AshaWorker.id == created_by) | (AshaWorker.worker_id == created_by.lower())
        ).first()
        if not worker:
            return error("validation_error", "created_by ASHA worker not found", status=400)
        asha_id = worker.id

    existing = Patient.query.filter_by(phone=phone).first()
    if existing:
        existing.name = name
        existing.age = age
        existing.gender = gender
        existing.village = village
        if asha_id:
            existing.created_by_asha_id = asha_id
        db.session.add(existing)
        patient = existing
        message = "Patient updated"
        status_code = 200
    else:
        patient = Patient(
            id=str(uuid.uuid4()),
            name=name,
            phone=phone,
            age=age,
            gender=gender,
            village=village,
            created_by_asha_id=asha_id,
            is_research_participant=True,
        )
        db.session.add(patient)
        message = "Patient created"
        status_code = 201

    if asha_id:
        assign = AshaPatientAssignment.query.filter_by(
            asha_id=asha_id, patient_id=patient.id, is_active=True
        ).first()
        if assign is None:
            db.session.add(
                AshaPatientAssignment(
                    asha_id=asha_id,
                    patient_id=patient.id,
                    assignment_type="PRIMARY",
                    is_active=True,
                    geographic_verified=False,
                )
            )

    db.session.commit()
    return success(
        {"patient_id": patient.id, "synced": True},
        status=status_code,
        message=message,
    )


@asha_bp.get("/me/dashboard")
@require_asha
def asha_dashboard():
    worker = g.current_user
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    month_start = _month_start_utc(now)

    screenings_today = Screening.query.filter(
        Screening.asha_id == worker.id,
        Screening.created_at >= today_start,
    ).count()

    screenings_month = Screening.query.filter(
        Screening.asha_id == worker.id,
        Screening.created_at >= month_start,
    ).count()

    commission_month = (
        db.session.query(db.func.coalesce(db.func.sum(Commission.amount), 0.0))
        .filter(Commission.asha_id == worker.id, Commission.created_at >= month_start)
        .scalar()
    )

    recent = (
        Screening.query.filter_by(asha_id=worker.id)
        .order_by(Screening.created_at.desc())
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
            "commission_balance": float(worker.commission_balance or 0),
            "recent_screenings": recent_out,
        }
    )


@asha_bp.get("/me/screenings")
@require_asha
def asha_screenings():
    worker = g.current_user
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = Screening.query.filter_by(asha_id=worker.id).order_by(Screening.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    out = []
    for s in items:
        cons = Consultation.query.filter_by(screening_id=s.id).first()
        first = (s.patient.name or "").split(" ")[0] if s.patient else ""
        out.append(
            {
                "id": s.id,
                "patient_first_name": first,
                "condition_type": s.condition_type,
                "risk_level": s.risk_level,
                "consultation_status": cons.status if cons else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
        )
    return paginated(out, total, page, per_page)


@asha_bp.get("/me/commissions")
@require_asha
def asha_commissions():
    worker = g.current_user
    items = (
        Commission.query.filter_by(asha_id=worker.id).order_by(Commission.created_at.desc()).all()
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


def _ensure_training_modules(asha_id: str) -> None:
    for code, _ in _TRAINING_SPECS:
        row = AshaTrainingModule.query.filter_by(asha_id=asha_id, module_code=code).first()
        if row is None:
            db.session.add(AshaTrainingModule(asha_id=asha_id, module_code=code, passed=False, attempts=0))
    db.session.commit()


@asha_bp.get("/me/patients/search")
@require_asha
def asha_patients_search():
    worker = g.current_user
    q_raw = str(request.args.get("q", "")).strip()
    if len(q_raw) < 2:
        return success({"items": []})
    like = f"%{q_raw}%"
    assigned_pids = [
        r.patient_id
        for r in AshaPatientAssignment.query.filter_by(asha_id=worker.id, is_active=True).all()
    ]
    qbase = Patient.query
    if assigned_pids:
        qbase = qbase.filter(Patient.id.in_(assigned_pids))
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
            "id": p.id,
            "name": p.name,
            "phone": p.phone,
            "village": p.village,
            "age": p.age,
            "gender": p.gender,
        }
        for p in items
    ]
    return success({"items": out})


@asha_bp.post("/patients/<patient_id>/wound-sites")
@require_asha
def asha_patient_wound_site_post(patient_id: str):
    """ASHA-assisted wound site registration (same payload as patient POST /me/wound-sites)."""
    worker = g.current_user
    p = Patient.query.get(patient_id)
    if not p:
        return error("not_found", "Patient not found", status=404)
    data = request.get_json(silent=True) or {}
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
        patient_id=p.id,
        foot_side=foot_side,
        location_on_foot=location_on_foot,
        toe_number=toe_i,
        first_detected_date=first_detected_date,
        status="ACTIVE",
        notes=sanitise_string(str(data.get("notes", ""))) or None,
        is_primary_site=bool(data.get("is_primary_site", True)),
        created_by_user_id=None,
    )
    db.session.add(w)
    db.session.flush()
    seed_wound_schedules_for_site(p.id, w.id)
    seed_skin_and_contributing_schedules_if_needed(p.id)
    db.session.commit()
    return success(
        {
            "wound_site": {
                "id": w.id,
                "foot_side": w.foot_side,
                "location_on_foot": w.location_on_foot,
                "patient_id": p.id,
            }
        },
        status=201,
    )


@asha_bp.get("/me/training")
@require_asha
def asha_training_status():
    worker = g.current_user
    _ensure_training_modules(worker.id)
    rows = AshaTrainingModule.query.filter_by(asha_id=worker.id).order_by(AshaTrainingModule.module_code).all()
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


@asha_bp.post("/me/training/complete")
@require_asha
def asha_training_complete():
    worker = g.current_user
    data = request.get_json(silent=True) or {}
    code = sanitise_string(str(data.get("module_code", "")))
    if not code:
        return error("validation_error", "module_code is required", status=400)
    _ensure_training_modules(worker.id)
    row = AshaTrainingModule.query.filter_by(asha_id=worker.id, module_code=code).first()
    if not row:
        return error("not_found", "Unknown module_code", status=404)
    score = data.get("score")
    row.passed = True
    row.score = float(score) if score is not None else 100.0
    row.attempts = int(row.attempts or 0) + 1
    row.completed_at = datetime.now(timezone.utc)
    db.session.add(row)
    db.session.commit()
    return success({"module_code": code, "passed": True})


@asha_bp.get("/me/offline-queue")
@require_asha
def asha_offline_queue_stub():
    """Phase C6 — offline upload queue (stub until offline_queue table is wired)."""
    return success(
        {
            "items": [],
            "pending_uploads": 0,
            "message": "No pending offline items (stub).",
        }
    )


@asha_bp.get("/me/enrollment-summary")
@require_asha
def asha_enrollment_summary():
    """Phase C6 — A10 enrollment snapshot."""
    worker = g.current_user
    n = AshaPatientAssignment.query.filter_by(asha_id=worker.id, is_active=True).count()
    return success({"assigned_patients": n, "geographic_verified_pending": 0})


@asha_bp.get("/me/commission-dashboard")
@require_asha
def asha_commission_dashboard():
    """Phase C6 — ledger + balance for A15."""
    worker = g.current_user
    rows = (
        AshaCommissionLedger.query.filter_by(asha_id=worker.id)
        .order_by(AshaCommissionLedger.earned_at.desc())
        .limit(40)
        .all()
    )
    pending_total = (
        db.session.query(func.coalesce(func.sum(AshaCommissionLedger.amount_rs), 0.0))
        .filter(AshaCommissionLedger.asha_id == worker.id, AshaCommissionLedger.payment_status == "PENDING")
        .scalar()
    )
    items = [
        {
            "id": r.id,
            "amount_rs": r.amount_rs,
            "commission_type": r.commission_type,
            "payment_status": r.payment_status,
            "earned_at": r.earned_at.isoformat() if r.earned_at else None,
            "session_id": r.session_id,
        }
        for r in rows
    ]
    return success(
        {
            "commission_balance": float(worker.commission_balance or 0),
            "pending_rs": float(pending_total or 0),
            "items": items,
        }
    )
