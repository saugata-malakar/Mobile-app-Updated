import json
from datetime import datetime, timezone

from flask import Blueprint, g, request
from sqlalchemy import func

from middleware.auth_middleware import require_auth
from models import (
    AiResult,
    Alert,
    Consultation,
    MonitoringSession,
    Patient,
    PatientConsent,
    PatientMedicalHistory,
    Prescription,
    Screening,
    SessionSchedule,
    WoundSite,
    db,
)
from utils.alert_actions import acknowledge_patient_alert
from utils.response_helper import error, paginated, success
from utils.schedule_generator import seed_skin_and_contributing_schedules_if_needed, seed_wound_schedules_for_site
from utils.validators import parse_json_object, sanitise_string

patients_bp = Blueprint("patients", __name__)


def _require_patient():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Patient access only", status=403)
    return None


@patients_bp.get("/me")
@require_auth
def patient_me():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    total_screenings = p.screenings.count()
    total_consultations = p.consultations.count()
    latest = (
        p.screenings.order_by(Screening.created_at.desc()).first()
    )
    return success(
        {
            "id": p.id,
            "name": p.name,
            "phone": p.phone,
            "age": p.age,
            "gender": p.gender,
            "village": p.village,
            "district": p.district,
            "known_conditions": p.known_conditions,
            "allergies": p.allergies,
            "abha_id": p.abha_id,
            "consent_given_at": p.consent_given_at.isoformat() if p.consent_given_at else None,
            "last_login": p.last_login.isoformat() if p.last_login else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "total_screenings": total_screenings,
            "total_consultations": total_consultations,
            "latest_screening_at": latest.created_at.isoformat() if latest else None,
        }
    )


@patients_bp.put("/me")
@require_auth
def patient_me_update():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    data = request.get_json(silent=True) or {}
    if "known_conditions" in data:
        p.known_conditions = sanitise_string(str(data.get("known_conditions")))
    if "allergies" in data:
        p.allergies = sanitise_string(str(data.get("allergies")))
    if "abha_id" in data:
        p.abha_id = sanitise_string(str(data.get("abha_id"))) or None
    if "district" in data:
        p.district = sanitise_string(str(data.get("district"))) or None
    db.session.commit()
    return success(
        {
            "id": p.id,
            "name": p.name,
            "phone": p.phone,
            "age": p.age,
            "gender": p.gender,
            "village": p.village,
            "district": p.district,
            "known_conditions": p.known_conditions,
            "allergies": p.allergies,
            "abha_id": p.abha_id,
        }
    )


@patients_bp.get("/me/screenings")
@require_auth
def patient_screenings():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = p.screenings.order_by(Screening.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    out = []
    for s in items:
        cons = Consultation.query.filter_by(screening_id=s.id).first()
        out.append(
            {
                "id": s.id,
                "condition_type": s.condition_type,
                "risk_level": s.risk_level,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "consultation_status": cons.status if cons else None,
            }
        )
    return paginated(out, total, page, per_page)


@patients_bp.get("/me/consultations")
@require_auth
def patient_consultations():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    q = p.consultations.order_by(Consultation.created_at.desc())
    out = []
    for c in q.all():
        doc_name = c.doctor.name if c.doctor else None
        out.append(
            {
                "id": c.id,
                "mode": c.mode,
                "status": c.status,
                "doctor_name": doc_name,
                "time_slot": c.time_slot,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
        )
    return success(out)


@patients_bp.get("/me/prescriptions")
@require_auth
def patient_prescriptions():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    q = p.prescriptions.order_by(Prescription.created_at.desc())
    out = []
    for pr in q.all():
        meds = parse_json_object(pr.medications)
        out.append(
            {
                "id": pr.id,
                "diagnosis": pr.diagnosis,
                "medications": meds,
                "doctor_name": pr.doctor.name if pr.doctor else None,
                "follow_up_days": pr.follow_up_days,
                "created_at": pr.created_at.isoformat() if pr.created_at else None,
            }
        )
    return success(out)


def _mh_row(m: PatientMedicalHistory) -> dict:
    return {
        "id": m.id,
        "version_number": m.version_number,
        "recorded_at": m.recorded_at.isoformat() if m.recorded_at else None,
        "diabetes_type": m.diabetes_type,
        "diabetes_duration_years": m.diabetes_duration_years,
        "hba1c_value": m.hba1c_value,
        "hba1c_date": m.hba1c_date,
        "has_hypertension": m.has_hypertension,
        "has_ckd": m.has_ckd,
        "has_cad": m.has_cad,
        "previous_dfu": m.previous_dfu,
        "current_medications": m.current_medications,
        "smoking_status": m.smoking_status,
        "bmi": m.bmi,
        "weight_kg": m.weight_kg,
        "bp_systolic": m.bp_systolic,
        "bp_diastolic": m.bp_diastolic,
        "notes": m.notes,
    }


@patients_bp.post("/me/medical-history")
@require_auth
def patient_medical_history_post():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    data = request.get_json(silent=True) or {}

    max_v = (
        db.session.query(func.max(PatientMedicalHistory.version_number))
        .filter(PatientMedicalHistory.patient_id == p.id)
        .scalar()
    )
    next_v = int(max_v or 0) + 1

    def b(name: str, default=False):
        v = data.get(name)
        if v is None:
            return default
        return bool(v)

    meds = data.get("current_medications")
    meds_s = json.dumps(meds) if isinstance(meds, (list, dict)) else (str(meds) if meds else None)

    row = PatientMedicalHistory(
        patient_id=p.id,
        version_number=next_v,
        recorded_at=datetime.now(timezone.utc),
        diabetes_type=sanitise_string(str(data.get("diabetes_type", ""))) or None,
        diabetes_duration_years=data.get("diabetes_duration_years"),
        hba1c_value=data.get("hba1c_value"),
        hba1c_date=str(data.get("hba1c_date", "")).strip() or None,
        has_hypertension=b("has_hypertension"),
        has_ckd=b("has_ckd"),
        has_cad=b("has_cad"),
        previous_dfu=b("previous_dfu"),
        current_medications=meds_s,
        smoking_status=sanitise_string(str(data.get("smoking_status", ""))) or None,
        bmi=data.get("bmi"),
        weight_kg=data.get("weight_kg"),
        bp_systolic=data.get("bp_systolic"),
        bp_diastolic=data.get("bp_diastolic"),
        notes=sanitise_string(str(data.get("notes", ""))) or None,
    )
    db.session.add(row)
    db.session.commit()
    return success({"medical_history_id": row.id, "version_number": row.version_number}, status=201)


@patients_bp.get("/me/medical-history")
@require_auth
def patient_medical_history_get():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    rows = (
        PatientMedicalHistory.query.filter_by(patient_id=p.id)
        .order_by(PatientMedicalHistory.version_number.desc())
        .all()
    )
    current = _mh_row(rows[0]) if rows else None
    history = [_mh_row(r) for r in rows]
    return success({"current": current, "history": history})


@patients_bp.post("/me/consent")
@require_auth
def patient_consent_post():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    data = request.get_json(silent=True) or {}
    version = sanitise_string(str(data.get("consent_version", "")))
    ctype = sanitise_string(str(data.get("consent_type", "")))
    if not version or not ctype:
        return error("validation_error", "consent_version and consent_type required", status=400)
    modules = data.get("modules_consented")
    if not isinstance(modules, list):
        return error("validation_error", "modules_consented must be a JSON array", status=400)
    sig = sanitise_string(str(data.get("digital_signature_hash", ""))) or None
    method = sanitise_string(str(data.get("signed_by_method", "DIGITAL_SIGNATURE"))) or "DIGITAL_SIGNATURE"

    c = PatientConsent(
        patient_id=p.id,
        consent_version=version,
        consent_type=ctype,
        signed_at=datetime.now(timezone.utc),
        signed_by_method=method,
        modules_consented=json.dumps(modules),
        digital_signature_hash=sig,
        is_active=True,
    )
    db.session.add(c)
    p.consent_given_at = datetime.now(timezone.utc)
    db.session.add(p)
    db.session.commit()
    return success({"consent_id": c.id}, status=201)


@patients_bp.get("/me/consents")
@require_auth
def patient_consents_get():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    rows = (
        PatientConsent.query.filter_by(patient_id=p.id)
        .order_by(PatientConsent.signed_at.desc())
        .all()
    )
    out = []
    for r in rows:
        try:
            mods = json.loads(r.modules_consented)
        except json.JSONDecodeError:
            mods = []
        out.append(
            {
                "id": r.id,
                "consent_version": r.consent_version,
                "consent_type": r.consent_type,
                "signed_at": r.signed_at.isoformat() if r.signed_at else None,
                "signed_by_method": r.signed_by_method,
                "modules_consented": mods,
                "digital_signature_hash": r.digital_signature_hash,
                "is_active": r.is_active,
            }
        )
    return success(out)


def _ws_row(w: WoundSite) -> dict:
    return {
        "id": w.id,
        "foot_side": w.foot_side,
        "location_on_foot": w.location_on_foot,
        "toe_number": w.toe_number,
        "first_detected_date": w.first_detected_date,
        "status": w.status,
        "current_wagner_grade": w.current_wagner_grade,
        "is_primary_site": w.is_primary_site,
        "notes": w.notes,
        "last_session_at": w.last_session_at.isoformat() if w.last_session_at else None,
        "total_sessions": w.total_sessions,
    }


@patients_bp.get("/me/wound-sites")
@require_auth
def patient_wound_sites_list():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    rows = WoundSite.query.filter_by(patient_id=p.id).order_by(WoundSite.created_at.desc()).all()
    return success({"items": [_ws_row(w) for w in rows]})


@patients_bp.post("/me/wound-sites")
@require_auth
def patient_wound_sites_post():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
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
    )
    db.session.add(w)
    db.session.flush()
    seed_wound_schedules_for_site(p.id, w.id)
    seed_skin_and_contributing_schedules_if_needed(p.id)
    db.session.commit()
    return success({"wound_site": _ws_row(w)}, status=201)


@patients_bp.get("/me/schedule")
@require_auth
def patient_schedule():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    rows = (
        SessionSchedule.query.filter_by(patient_id=p.id)
        .order_by(SessionSchedule.scheduled_date.asc())
        .limit(50)
        .all()
    )
    out = []
    for r in rows:
        out.append(
            {
                "id": r.id,
                "wound_site_id": r.wound_site_id,
                "session_type": r.session_type,
                "scheduled_date": r.scheduled_date,
                "due_by_date": r.due_by_date,
                "status": r.status,
            }
        )
    return success({"items": out})


@patients_bp.get("/me/monitoring-sessions")
@require_auth
def patient_monitoring_sessions():
    """Submitted monitoring sessions for history UIs (e.g. P17 skin past sessions)."""
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    session_type = sanitise_string(str(request.args.get("session_type", ""))) or None
    try:
        limit = int(request.args.get("limit") or 12)
    except ValueError:
        limit = 12
    limit = max(1, min(limit, 50))

    q = MonitoringSession.query.filter_by(patient_id=p.id, status="SUBMITTED")
    if session_type:
        q = q.filter(MonitoringSession.session_type == session_type.upper())
    rows = q.order_by(MonitoringSession.submitted_at.desc()).limit(limit).all()

    items = []
    for ms in rows:
        air = AiResult.query.filter_by(session_id=ms.id).first()
        detail: dict = {}
        if air and air.details_json:
            try:
                parsed = json.loads(air.details_json)
                if isinstance(parsed, dict):
                    detail = parsed
            except (json.JSONDecodeError, TypeError):
                detail = {}
        items.append(
            {
                "session_id": ms.id,
                "session_type": ms.session_type,
                "submitted_at": ms.submitted_at.isoformat() if ms.submitted_at else None,
                "alert_level": air.alert_level if air else None,
                "skin_condition_primary": detail.get("skin_condition_primary"),
                "skin_wound_risk_level": detail.get("skin_wound_risk_level"),
                "pallor_level": detail.get("pallor_level"),
                "pallor_confidence": detail.get("pallor_confidence"),
                "pallor_wound_implication": detail.get("pallor_wound_implication"),
                "eye_urgency": detail.get("eye_urgency"),
                "eye_urgency_confidence": detail.get("eye_urgency_confidence"),
                "wound_connection_explanation_en": detail.get("wound_connection_explanation_en"),
            }
        )
    return success({"items": items})


@patients_bp.get("/me/wound-history")
@require_auth
def patient_wound_history():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    wound_site_id = request.args.get("wound_site_id")
    q = (
        db.session.query(MonitoringSession, AiResult)
        .join(AiResult, AiResult.session_id == MonitoringSession.id)
        .filter(MonitoringSession.patient_id == p.id, MonitoringSession.track == "WOUND")
    )
    if wound_site_id:
        q = q.filter(MonitoringSession.wound_site_id == str(wound_site_id))
    rows = q.order_by(MonitoringSession.submitted_at.desc()).limit(24).all()
    labels = []
    areas = []
    wagner = []
    for ms, air in rows:
        if ms.submitted_at:
            labels.append(ms.submitted_at.date().isoformat())
        else:
            labels.append("")
        areas.append(float(air.wound_area_cm2 or 0))
        wagner.append(int(air.wagner_grade or 0))
    items = []
    for ms, air in rows:
        items.append(
            {
                "session_id": ms.id,
                "submitted_at": ms.submitted_at.isoformat() if ms.submitted_at else None,
                "wound_site_id": ms.wound_site_id,
                "wound_area_cm2": air.wound_area_cm2,
                "wagner_grade": air.wagner_grade,
                "alert_level": air.alert_level,
            }
        )
    return success({"chart": {"labels": list(reversed(labels)), "areas": list(reversed(areas)), "wagner": list(reversed(wagner))}, "items": items})


def _alert_row(a: Alert) -> dict:
    return {
        "id": a.id,
        "session_id": a.session_id,
        "wound_site_id": a.wound_site_id,
        "alert_level": a.alert_level,
        "alert_type": a.alert_type,
        "message_patient_en": a.message_patient_en,
        "message_patient_bn": a.message_patient_bn,
        "message_doctor_en": a.message_doctor_en,
        "generated_at": a.generated_at.isoformat() if a.generated_at else None,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        "acknowledgement_note": a.acknowledgement_note,
        "escalation_level": int(a.escalation_level or 0),
        "escalation_at": a.escalation_at.isoformat() if a.escalation_at else None,
    }


@patients_bp.get("/me/alerts")
@require_auth
def patient_alerts_list():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    q = Alert.query.filter_by(patient_id=p.id)
    resolved = request.args.get("resolved")
    if resolved is not None:
        rl = str(resolved).lower()
        if rl in ("true", "1", "yes"):
            q = q.filter(Alert.resolved_at.isnot(None))
        elif rl in ("false", "0", "no"):
            q = q.filter(Alert.resolved_at.is_(None))
    level = request.args.get("alert_level")
    if level:
        q = q.filter(Alert.alert_level == str(level).strip().upper())
    try:
        limit = int(request.args.get("limit", 40))
    except (TypeError, ValueError):
        limit = 40
    limit = max(1, min(limit, 100))
    rows = q.order_by(Alert.generated_at.desc()).limit(limit).all()
    return success({"items": [_alert_row(a) for a in rows]})


@patients_bp.post("/me/alerts/<alert_id>/acknowledge")
@require_auth
def patient_alert_acknowledge(alert_id: str):
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    data = request.get_json(silent=True) or {}
    note = data.get("note")
    return acknowledge_patient_alert(p, alert_id, note if note is not None else None)


@patients_bp.get("/me/photos")
@require_auth
def patient_photos():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    cond = request.args.get("condition_type")
    q = p.screenings.order_by(Screening.created_at.asc())
    if cond:
        q = q.filter(Screening.condition_type == cond)
    items = q.limit(10).all()
    out = []
    for s in items:
        first = None
        if s.photo_data:
            try:
                arr = json.loads(s.photo_data)
                if isinstance(arr, list) and arr:
                    first = arr[0]
            except json.JSONDecodeError:
                first = None
        out.append(
            {
                "screening_id": s.id,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "condition_type": s.condition_type,
                "risk_level": s.risk_level,
                "photo": first,
            }
        )
    return success(out)
