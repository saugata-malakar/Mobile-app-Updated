"""Doctor web dashboard API (D1–D10)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, request
from sqlalchemy import case, func

from middleware.auth_middleware import require_doctor
from models import (
    AiResult,
    Alert,
    Consultation,
    Doctor,
    DoctorPatientAssignment,
    MonitoringSession,
    Patient,
    Prescription,
    Screening,
    TeleconsultRequest,
    WoundSite,
    db,
)
from utils.doctor_dashboard import ALERT_ORDER, build_patient_list, wound_area_chart
from utils.response_helper import error, success
from utils.validators import sanitise_string

doctors_bp = Blueprint("doctors", __name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_dt(value: str | None) -> datetime | None:
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


def _alert_dict(a: Alert, patient: Patient | None = None) -> dict:
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_name": patient.name if patient else None,
        "patient_phone": patient.phone if patient else None,
        "session_id": a.session_id,
        "wound_site_id": a.wound_site_id,
        "alert_level": a.alert_level,
        "alert_type": a.alert_type,
        "message_doctor_en": a.message_doctor_en or a.message_patient_en,
        "generated_at": a.generated_at.isoformat() if a.generated_at else None,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        "acknowledgement_note": a.acknowledgement_note,
        "escalation_level": int(a.escalation_level or 0),
    }


def _can_access_patient(doc: Doctor, patient_id: str) -> bool:
    assigned = DoctorPatientAssignment.query.filter_by(
        doctor_id=doc.id, patient_id=patient_id, is_active=True
    ).first()
    if assigned:
        return True
    if DoctorPatientAssignment.query.filter_by(doctor_id=doc.id, is_active=True).count() == 0:
        return Patient.query.get(patient_id) is not None
    return False


@doctors_bp.get("/me")
@require_doctor
def doctor_me():
    doc: Doctor = g.current_user
    return success(
        {
            "id": doc.id,
            "name": doc.name,
            "email": doc.email,
            "specialisation": doc.specialisation,
            "hospital_name": doc.hospital_name,
            "hospital_department": doc.hospital_department,
            "consultation_phone": doc.consultation_phone,
            "role": "doctor",
        }
    )


@doctors_bp.get("/me/alerts")
@require_doctor
def doctor_alerts_inbox():
    doc: Doctor = g.current_user
    resolved = request.args.get("resolved", "false").lower() in ("true", "1", "yes")
    q = Alert.query
    if not resolved:
        q = q.filter(Alert.resolved_at.is_(None))
    else:
        q = q.filter(Alert.resolved_at.isnot(None))

    assigned_pids = [
        a.patient_id
        for a in DoctorPatientAssignment.query.filter_by(doctor_id=doc.id, is_active=True).all()
    ]
    if assigned_pids:
        q = q.filter(Alert.patient_id.in_(assigned_pids))

    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    limit = max(1, min(limit, 100))
    rows = q.order_by(ALERT_ORDER, Alert.generated_at.desc()).limit(limit).all()
    items = []
    for a in rows:
        p = Patient.query.get(a.patient_id)
        items.append(_alert_dict(a, p))
    return success({"items": items})


@doctors_bp.get("/me/patients")
@require_doctor
def doctor_patients():
    doc: Doctor = g.current_user
    return success({"patients": build_patient_list(doc.id)})


@doctors_bp.get("/patients/<patient_id>")
@require_doctor
def doctor_patient_summary(patient_id: str):
    doc: Doctor = g.current_user
    if not _can_access_patient(doc, patient_id):
        return error("forbidden", "Patient not in your panel", status=403)
    p = Patient.query.get(patient_id)
    if not p:
        return error("not_found", "Patient not found", status=404)
    sites = WoundSite.query.filter_by(patient_id=p.id, status="ACTIVE").all()
    open_alerts = (
        Alert.query.filter_by(patient_id=p.id)
        .filter(Alert.resolved_at.is_(None))
        .order_by(ALERT_ORDER)
        .all()
    )
    return success(
        {
            "patient": {
                "id": p.id,
                "name": p.name,
                "phone": p.phone,
                "age": p.age,
                "gender": p.gender,
                "village": p.village,
                "known_conditions": p.known_conditions,
            },
            "wound_sites": [
                {
                    "id": ws.id,
                    "foot_side": ws.foot_side,
                    "location_on_foot": ws.location_on_foot,
                    "toe_number": ws.toe_number,
                    "current_wagner_grade": ws.current_wagner_grade,
                }
                for ws in sites
            ],
            "open_alerts": [_alert_dict(a, p) for a in open_alerts],
        }
    )


@doctors_bp.get("/patients/<patient_id>/wound-detail")
@require_doctor
def doctor_patient_wound_detail(patient_id: str):
    doc: Doctor = g.current_user
    if not _can_access_patient(doc, patient_id):
        return error("forbidden", "Patient not in your panel", status=403)
    p = Patient.query.get(patient_id)
    if not p:
        return error("not_found", "Patient not found", status=404)
    wound_site_id = request.args.get("wound_site_id")
    chart = wound_area_chart(p.id, wound_site_id)
    latest = (
        db.session.query(MonitoringSession, AiResult)
        .join(AiResult, AiResult.session_id == MonitoringSession.id)
        .filter(MonitoringSession.patient_id == p.id, MonitoringSession.track == "WOUND")
        .order_by(MonitoringSession.submitted_at.desc())
        .first()
    )
    latest_payload = None
    if latest:
        ms, air = latest
        latest_payload = {
            "session_id": ms.id,
            "submitted_at": ms.submitted_at.isoformat() if ms.submitted_at else None,
            "wound_area_cm2": air.wound_area_cm2,
            "wagner_grade": air.wagner_grade,
            "alert_level": air.alert_level,
            "overall_confidence": air.overall_confidence,
        }
    trend = "stable"
    if len(chart["areas"]) >= 2:
        if chart["areas"][-1] < chart["areas"][-2] * 0.9:
            trend = "healing"
        elif chart["areas"][-1] > chart["areas"][-2] * 1.1:
            trend = "worsening"
    return success(
        {
            "patient": {"id": p.id, "name": p.name},
            "chart": chart,
            "latest_session": latest_payload,
            "trend": trend,
        }
    )


@doctors_bp.put("/alerts/<alert_id>/acknowledge")
@require_doctor
def doctor_acknowledge_alert(alert_id: str):
    doc: Doctor = g.current_user
    row = Alert.query.get(alert_id)
    if not row:
        return error("not_found", "Alert not found", status=404)
    if not _can_access_patient(doc, row.patient_id):
        return error("forbidden", "Patient not in your panel", status=403)
    data = request.get_json(silent=True) or {}
    note = sanitise_string(data.get("note", "")) or None
    row.acknowledgement_note = note
    if data.get("resolve", True):
        row.resolved_at = _utcnow()
    db.session.commit()
    p = Patient.query.get(row.patient_id)
    return success({"alert": _alert_dict(row, p)})


@doctors_bp.get("/me/teleconsults")
@require_doctor
def doctor_teleconsults():
    doc: Doctor = g.current_user
    status = request.args.get("status")
    q = TeleconsultRequest.query.filter(
        (TeleconsultRequest.assigned_doctor_id == doc.id)
        | (TeleconsultRequest.assigned_doctor_id.is_(None))
    )
    if status:
        q = q.filter(TeleconsultRequest.status == str(status).upper())
    else:
        q = q.filter(TeleconsultRequest.status.in_(("PENDING", "ASSIGNED", "SCHEDULED")))
    rows = q.order_by(TeleconsultRequest.requested_at.asc()).limit(50).all()
    items = []
    for tc in rows:
        p = Patient.query.get(tc.patient_id)
        items.append(
            {
                "id": tc.id,
                "patient_id": tc.patient_id,
                "patient_name": p.name if p else None,
                "patient_phone": p.phone if p else None,
                "status": tc.status,
                "request_type": tc.request_type,
                "patient_concern_en": tc.patient_concern_en,
                "scheduled_at": tc.scheduled_at.isoformat() if tc.scheduled_at else None,
                "preferred_callback_time": tc.preferred_callback_time,
                "requested_at": tc.requested_at.isoformat() if tc.requested_at else None,
            }
        )
    return success({"items": items})


@doctors_bp.put("/teleconsults/<tc_id>/schedule")
@require_doctor
def doctor_schedule_teleconsult(tc_id: str):
    doc: Doctor = g.current_user
    tc = TeleconsultRequest.query.get(tc_id)
    if not tc:
        return error("not_found", "Teleconsult not found", status=404)
    data = request.get_json(silent=True) or {}
    scheduled_raw = data.get("scheduled_at") or data.get("scheduled_callback_time")
    scheduled = _parse_iso_dt(str(scheduled_raw) if scheduled_raw else None)
    if not scheduled:
        return error("validation_error", "scheduled_at (ISO datetime) required", status=400)
    if scheduled < _utcnow():
        return error("validation_error", "scheduled_at must be in the future", status=400)
    tc.assigned_doctor_id = doc.id
    tc.scheduled_at = scheduled
    tc.estimated_callback_at = scheduled
    tc.status = "SCHEDULED"
    tc.assigned_at = _utcnow()
    if data.get("doctor_notes"):
        tc.doctor_notes = sanitise_string(data.get("doctor_notes"))[:4000]
    db.session.commit()
    p = Patient.query.get(tc.patient_id)
    return success(
        {
            "id": tc.id,
            "status": tc.status,
            "scheduled_at": tc.scheduled_at.isoformat(),
            "patient_name": p.name if p else None,
        }
    )


@doctors_bp.post("/prescriptions")
@require_doctor
def doctor_write_prescription():
    doc: Doctor = g.current_user
    data = request.get_json(silent=True) or {}
    patient_id = str(data.get("patient_id", "")).strip()
    if not patient_id or not _can_access_patient(doc, patient_id):
        return error("validation_error", "patient_id required", status=400)

    medications = data.get("medications")
    diagnosis = sanitise_string(data.get("diagnosis")) or "Wound care plan"
    if medications is None:
        return error("validation_error", "medications required", status=400)
    if not isinstance(medications, list):
        return error("validation_error", "medications must be a list", status=400)

    wound_care = sanitise_string(data.get("wound_care_instructions_en", "")) or ""
    referral_required = bool(data.get("referral_required"))
    payload = {
        "medications": medications,
        "wound_care_instructions_en": wound_care,
        "dressing_type": data.get("dressing_type"),
        "dressing_change_frequency": data.get("dressing_change_frequency"),
        "referral_required": referral_required,
        "referral_speciality": data.get("referral_speciality"),
        "referral_urgency": data.get("referral_urgency"),
        "referral_reason": data.get("referral_reason"),
    }

    teleconsult_id = data.get("teleconsult_id")
    session_id = data.get("session_id")
    tc = None
    if teleconsult_id:
        tc = TeleconsultRequest.query.get(str(teleconsult_id))
        if not tc or tc.patient_id != patient_id:
            return error("validation_error", "Invalid teleconsult_id", status=400)
        tc.prescription_json = json.dumps({**payload, "diagnosis": diagnosis})
        tc.doctor_notes = (tc.doctor_notes or "") + f"\nRx issued {_utcnow().isoformat()}"
        tc.status = "COMPLETED" if tc.status == "SCHEDULED" else tc.status

    prescription_id = None
    consultation = (
        Consultation.query.filter_by(patient_id=patient_id, doctor_id=doc.id)
        .order_by(Consultation.created_at.desc())
        .first()
    )
    if consultation and not consultation.prescription:
        pr = Prescription(
            consultation_id=consultation.id,
            doctor_id=doc.id,
            patient_id=patient_id,
            diagnosis=diagnosis,
            icd10_code=data.get("icd10_code"),
            medications=json.dumps(medications),
            instructions=json.dumps(payload),
            follow_up_days=int(data.get("follow_up_days", 7)),
        )
        db.session.add(pr)
        consultation.status = "completed"
        consultation.completed_at = _utcnow()
        prescription_id = pr.id

    db.session.commit()

    return success(
        {
            "prescription_id": prescription_id,
            "teleconsult_id": teleconsult_id,
            "session_id": session_id,
            "diagnosis": diagnosis,
            "payload": payload,
            "stored_in_teleconsult": bool(tc),
        },
        status=201,
    )


@doctors_bp.get("/department/dashboard")
@require_doctor
def department_dashboard():
    doc: Doctor = g.current_user
    hospital = doc.hospital_name or "Unassigned Hospital"
    dept = doc.hospital_department or "General"

    doctor_ids = [
        d.id
        for d in Doctor.query.filter(
            Doctor.hospital_name == hospital,
            Doctor.active.is_(True),
        ).all()
    ]
    if not doctor_ids:
        doctor_ids = [doc.id]

    month_start = datetime(_utcnow().year, _utcnow().month, 1, tzinfo=timezone.utc)
    open_red = Alert.query.filter(
        Alert.resolved_at.is_(None), Alert.alert_level == "RED"
    ).count()
    open_amber = Alert.query.filter(
        Alert.resolved_at.is_(None), Alert.alert_level == "AMBER"
    ).count()

    sessions_month = MonitoringSession.query.filter(
        MonitoringSession.submitted_at >= month_start,
        MonitoringSession.track == "WOUND",
    ).count()

    try:
        teleconsults_pending = TeleconsultRequest.query.filter(
            TeleconsultRequest.status.in_(("PENDING", "ASSIGNED", "SCHEDULED"))
        ).count()
    except Exception:
        db.session.rollback()
        teleconsults_pending = 0

    prescriptions_month = Prescription.query.filter(
        Prescription.doctor_id.in_(doctor_ids),
        Prescription.created_at >= month_start,
    ).count()

    patients_monitored = (
        db.session.query(func.count(func.distinct(MonitoringSession.patient_id)))
        .filter(MonitoringSession.track == "WOUND", MonitoringSession.submitted_at >= month_start)
        .scalar()
    )

    alert_by_level = (
        db.session.query(Alert.alert_level, func.count(Alert.id))
        .filter(Alert.generated_at >= month_start)
        .group_by(Alert.alert_level)
        .all()
    )

    return success(
        {
            "hospital_name": hospital,
            "department": dept,
            "period": month_start.strftime("%Y-%m"),
            "kpis": {
                "patients_monitored": int(patients_monitored or 0),
                "wound_sessions_month": sessions_month,
                "open_red_alerts": open_red,
                "open_amber_alerts": open_amber,
                "pending_teleconsults": teleconsults_pending,
                "prescriptions_issued_month": prescriptions_month,
                "doctors_active": len(doctor_ids),
            },
            "alert_breakdown": {lvl: cnt for lvl, cnt in alert_by_level},
        }
    )


@doctors_bp.get("/me/queue")
@require_doctor
def doctor_queue():
    doc: Doctor = g.current_user
    risk_order = case(
        (Screening.risk_level == "high", 0),
        (Screening.risk_level == "medium", 1),
        else_=2,
    )
    q = (
        Consultation.query.join(Screening)
        .filter(Consultation.status == "pending")
        .filter((Consultation.doctor_id.is_(None)) | (Consultation.doctor_id == doc.id))
        .order_by(risk_order, Consultation.created_at.asc())
    )
    out = []
    for c in q.all():
        out.append(
            {
                "consultation_id": c.id,
                "patient_id": c.patient_id,
                "risk_level": c.screening.risk_level,
                "mode": c.mode,
            }
        )
    return success(out)


@doctors_bp.post("/me/availability")
@require_doctor
def doctor_availability():
    doc: Doctor = g.current_user
    data = request.get_json(silent=True) or {}
    if "availability" not in data:
        return error("validation_error", "availability required", status=400)
    if isinstance(data["availability"], (dict, list)):
        doc.availability = json.dumps(data["availability"])
    else:
        doc.availability = str(data["availability"])
    db.session.commit()
    return success(
        {
            "id": doc.id,
            "name": doc.name,
            "availability": data["availability"],
        }
    )


@doctors_bp.get("/me/stats")
@require_doctor
def doctor_stats():
    doc: Doctor = g.current_user
    now = _utcnow()
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    cases_today = doc.cases_today
    cases_month = Consultation.query.filter(
        Consultation.doctor_id == doc.id,
        Consultation.created_at >= month_start,
    ).count()

    return success(
        {
            "cases_today": cases_today,
            "cases_this_month": cases_month,
            "average_rating": doc.rating,
        }
    )
