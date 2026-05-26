import bcrypt
from datetime import datetime, timezone

from flask import Blueprint, g, request

from middleware.auth_middleware import require_admin
from models import AshaWorker, Consultation, Doctor, Patient, Screening, db
from utils.alert_escalation import run_red_alert_escalation
from utils.response_helper import error, paginated, success

admin_bp = Blueprint("admin", __name__)


def _today_start_utc():
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)


@admin_bp.get("/dashboard")
@require_admin
def admin_dashboard():
    today = _today_start_utc()
    total_patients = Patient.query.count()
    total_asha = AshaWorker.query.count()
    screenings_today = Screening.query.filter(Screening.created_at >= today).count()
    pending_consultations = Consultation.query.filter(Consultation.status == "pending").count()
    completed_today = Consultation.query.filter(
        Consultation.status == "completed",
        Consultation.completed_at >= today,
    ).count()
    return success(
        {
            "total_patients": total_patients,
            "total_asha_workers": total_asha,
            "total_screenings_today": screenings_today,
            "pending_consultations": pending_consultations,
            "completed_consultations_today": completed_today,
        }
    )


@admin_bp.get("/patients")
@require_admin
def admin_patients():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = request.args.get("q", "").strip()
    query = Patient.query
    if q:
        like = f"%{q}%"
        query = query.filter((Patient.name.ilike(like)) | (Patient.phone.ilike(like)))
    total = query.count()
    items = query.order_by(Patient.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    out = [{"id": p.id, "name": p.name, "phone": p.phone, "village": p.village} for p in items]
    return paginated(out, total, page, per_page)


@admin_bp.get("/asha-workers")
@require_admin
def admin_asha():
    workers = AshaWorker.query.all()
    out = []
    for w in workers:
        screening_count = Screening.query.filter_by(asha_id=w.id).count()
        out.append(
            {
                "id": w.id,
                "worker_id": w.worker_id,
                "name": w.name,
                "village": w.village,
                "screening_count": screening_count,
                "active": w.active,
            }
        )
    return success(out)


@admin_bp.post("/doctors")
@require_admin
def admin_create_doctor():
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    nmc = data.get("nmc_number")
    if not all([name, email, password, nmc]):
        return error("validation_error", "name, email, password, nmc_number required", status=400)
    if Doctor.query.filter(db.func.lower(Doctor.email) == email.lower()).first():
        return error("duplicate", "Email exists", status=409)
    doc = Doctor(
        name=name,
        email=email.lower(),
        password_hash=bcrypt.hashpw(str(password).encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        nmc_number=nmc,
        specialisation=data.get("specialisation"),
        languages=data.get("languages", "Bengali,Hindi"),
    )
    db.session.add(doc)
    db.session.commit()
    return success({"id": doc.id, "email": doc.email}, status=201)


@admin_bp.put("/doctors/<doctor_id>/activate")
@require_admin
def activate_doctor(doctor_id):
    doc = Doctor.query.get(doctor_id)
    if not doc:
        return error("not_found", "Not found", status=404)
    doc.active = True
    db.session.commit()
    return success({"id": doc.id, "active": True})


@admin_bp.put("/doctors/<doctor_id>/deactivate")
@require_admin
def deactivate_doctor(doctor_id):
    doc = Doctor.query.get(doctor_id)
    if not doc:
        return error("not_found", "Not found", status=404)
    doc.active = False
    db.session.commit()
    return success({"id": doc.id, "active": False})


@admin_bp.get("/consultations")
@require_admin
def admin_consultations():
    q = Consultation.query.join(Screening)
    status = request.args.get("status")
    risk = request.args.get("risk_level")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    if status:
        q = q.filter(Consultation.status == status)
    if risk:
        q = q.filter(Screening.risk_level == risk)
    if date_from:
        q = q.filter(Consultation.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Consultation.created_at <= datetime.fromisoformat(date_to))
    items = q.order_by(Consultation.created_at.desc()).limit(200).all()
    out = []
    for c in items:
        out.append(
            {
                "id": c.id,
                "status": c.status,
                "mode": c.mode,
                "risk_level": c.screening.risk_level,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
        )
    return success(out)


@admin_bp.post("/jobs/escalate-red-alerts")
@require_admin
def admin_escalate_red_alerts():
    """Phase C1 — run stale RED alert escalation scan (stub notifications)."""
    n = run_red_alert_escalation()
    return success({"stale_red_alerts_notified": n})
