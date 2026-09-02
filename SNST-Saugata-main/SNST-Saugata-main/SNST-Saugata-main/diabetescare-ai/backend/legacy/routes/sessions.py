"""Monitoring sessions API (Phase B/C): create, attach photographs, submit (stub AI + alerts)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, request

from middleware.auth_middleware import require_auth
from models import (
    AiResult,
    AshaCommissionLedger,
    AshaWorker,
    MonitoringSession,
    Photograph,
    WoundSite,
    db,
)
from subscription_service import get_patient_subscription, patient_has_module_access
from utils.alert_engine import generate_alerts_after_ai_result
from utils.response_helper import error, success
from utils.validators import sanitise_string

sessions_bp = Blueprint("sessions", __name__)


def _require_patient():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Patient access only", status=403)
    return None


def _session_owned(ms: MonitoringSession, patient_id: str) -> bool:
    return ms.patient_id == patient_id


def _build_stub_ai_result(ms: MonitoringSession) -> AiResult:
    st = (ms.session_type or "").upper()
    now = datetime.now(timezone.utc)
    if st == "SKIN_MONITOR":
        # Realistic stub until the skin model is trained (Phase C2 — CURSOR_MASTER_PROMPT Section 6).
        skin_details = {
            "skin_condition_primary": "TINEA_PEDIS",
            "skin_condition_confidence": 0.82,
            "maceration_detected": 0,
            "skin_wound_risk_level": "MEDIUM",
            "treatment_recommendation": {
                "otc_medication_en": "Terbinafine 1% cream (or clotrimazole 1% cream)",
                "dose_en": "Thin layer to affected areas",
                "duration_en": "14 days, continue 1 week after clearing if advised by packaging",
                "hygiene_en": "Wash feet daily, dry well between toes, change socks daily",
                "otc_medication_bn": "টারবিনাফাইন ১% ক্রিম (বা ক্লোট্রিমাজল ১% ক্রিম)",
                "dose_bn": "প্রভাবিত স্থানে পাতলা স্তর",
                "duration_bn": "১৪ দিন",
                "hygiene_bn": "প্রতিদিন পা ধুয়ে আঙুলের ফাঁক ভালো করে মুছুন",
            },
            "prescription_required": 0,
        }
        return AiResult(
            id=str(uuid.uuid4()),
            session_id=ms.id,
            model_version="stub-skin-c2",
            processing_method="STUB",
            overall_confidence=0.82,
            wound_area_cm2=None,
            wagner_grade=None,
            alert_level="YELLOW",
            details_json=json.dumps(skin_details),
        )
    if st == "PALLOR_TRIAGE":
        pallor_details = {
            "pallor_level": "MILD",
            "pallor_confidence": 0.78,
            "pallor_wound_implication": "Mild anaemia may slow wound healing",
            "wound_connection_explanation_en": (
                "How this relates to your wound: mild pallor may reflect lower iron stores, "
                "which can slow healing — discuss a blood test with your clinician."
            ),
        }
        return AiResult(
            id=str(uuid.uuid4()),
            session_id=ms.id,
            model_version="stub-pallor-c3",
            processing_method="STUB",
            overall_confidence=0.78,
            wound_area_cm2=None,
            wagner_grade=None,
            alert_level="YELLOW",
            details_json=json.dumps(pallor_details),
        )
    if st == "EYE_TRIAGE":
        eye_details = {
            "eye_urgency": "NON_URGENT",
            "eye_urgency_confidence": 0.91,
            "wound_connection_explanation_en": (
                "How this relates to your wound: this check views the front of the eye only; "
                "non-urgent findings here are less likely to stop you from doing daily wound care."
            ),
        }
        return AiResult(
            id=str(uuid.uuid4()),
            session_id=ms.id,
            model_version="stub-eye-c3",
            processing_method="STUB",
            overall_confidence=0.91,
            wound_area_cm2=None,
            wagner_grade=None,
            alert_level="GREEN",
            details_json=json.dumps(eye_details),
        )
    return AiResult(
        id=str(uuid.uuid4()),
        session_id=ms.id,
        model_version="stub-phase-b-1",
        processing_method="STUB",
        overall_confidence=0.72,
        wound_area_cm2=1.85,
        wagner_grade=1,
        alert_level="YELLOW",
    )


def _maybe_asha_commission(p, ms: MonitoringSession) -> None:
    asha_id = getattr(p, "created_by_asha_id", None)
    if not asha_id:
        return
    worker = AshaWorker.query.get(str(asha_id))
    db.session.add(
        AshaCommissionLedger(
            id=str(uuid.uuid4()),
            asha_id=str(asha_id),
            patient_id=p.id,
            session_id=ms.id,
            commission_type="MONITORING_SESSION",
            amount_rs=25.0,
        )
    )
    if worker:
        worker.commission_balance = float(worker.commission_balance or 0) + 25.0
        db.session.add(worker)


@sessions_bp.post("")
@require_auth
def create_session():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    data = request.get_json(silent=True) or {}
    wound_site_id = data.get("wound_site_id")
    session_type = sanitise_string(str(data.get("session_type", "WOUND_MONITOR"))) or "WOUND_MONITOR"
    track = sanitise_string(str(data.get("track", "WOUND"))) or "WOUND"

    if wound_site_id:
        ws = WoundSite.query.filter_by(id=str(wound_site_id), patient_id=p.id).first()
        if not ws:
            return error("validation_error", "wound_site_id not found for patient", status=400)

    ms = MonitoringSession(
        id=str(uuid.uuid4()),
        patient_id=p.id,
        wound_site_id=str(wound_site_id) if wound_site_id else None,
        session_type=session_type,
        track=track,
        status="CAPTURE_IN_PROGRESS",
        submitted_by_user_id=None,
        submission_method="MOBILE",
    )
    db.session.add(ms)
    db.session.commit()
    return success({"session": {"id": ms.id, "status": ms.status}}, status=201)


@sessions_bp.post("/<session_id>/photographs")
@require_auth
def add_photograph(session_id: str):
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    ms = MonitoringSession.query.get(session_id)
    if not ms or not _session_owned(ms, p.id):
        return error("not_found", "Session not found", status=404)
    if ms.status not in ("CAPTURE_IN_PROGRESS", "DRAFT"):
        return error("validation_error", "Session is not accepting photographs", status=400)

    data = request.get_json(silent=True) or {}
    angle = sanitise_string(str(data.get("angle", "TOP"))) or "TOP"
    gcs_url = sanitise_string(str(data.get("gcs_url", ""))) or None
    quality_score = data.get("quality_score")

    ph = Photograph(
        id=str(uuid.uuid4()),
        session_id=ms.id,
        angle=angle,
        gcs_url=gcs_url or "stub://local/phase-b-placeholder",
        quality_score=float(quality_score) if quality_score is not None else None,
        upload_status="RECEIVED",
    )
    db.session.add(ph)
    db.session.commit()
    return success({"photograph": {"id": ph.id, "angle": ph.angle}}, status=201)


@sessions_bp.post("/<session_id>/submit")
@require_auth
def submit_session(session_id: str):
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    sub = get_patient_subscription(p.id)
    allowed, reason = patient_has_module_access(sub)
    if not allowed:
        return error(
            "subscription_inactive",
            reason or "Subscription suspended or expired — renew to submit sessions",
            status=403,
        )
    ms = MonitoringSession.query.get(session_id)
    if not ms or not _session_owned(ms, p.id):
        return error("not_found", "Session not found", status=404)

    photos = Photograph.query.filter_by(session_id=ms.id).count()
    stype = (ms.session_type or "").upper()
    min_photos = 4 if stype == "SKIN_MONITOR" else 1
    if photos < min_photos:
        msg = (
            "Add four photographs (web spaces, sole, periwound, lower leg) before submit"
            if stype == "SKIN_MONITOR"
            else "Add at least one photograph before submit"
        )
        return error("validation_error", msg, status=400)

    now = datetime.now(timezone.utc)
    ms.submitted_at = now
    ms.status = "SUBMITTED"
    ms.ai_processing_completed_at = now

    if ms.wound_site_id:
        ws = WoundSite.query.get(ms.wound_site_id)
        if ws:
            ws.last_session_at = now
            ws.total_sessions = int(ws.total_sessions or 0) + 1

    existing = AiResult.query.filter_by(session_id=ms.id).first()
    if existing:
        db.session.commit()
        return success({"ai_result": _ai_row(existing), "session_id": ms.id, "session_type": ms.session_type})

    air = _build_stub_ai_result(ms)
    db.session.add(air)
    alert_id = generate_alerts_after_ai_result(p, ms, air)
    _maybe_asha_commission(p, ms)
    db.session.commit()
    body = {"ai_result": _ai_row(air), "session_id": ms.id, "session_type": ms.session_type}
    if alert_id:
        body["alert_id"] = alert_id
    return success(body)


def _ai_row(air: AiResult) -> dict:
    row = {
        "id": air.id,
        "model_version": air.model_version,
        "wound_area_cm2": air.wound_area_cm2,
        "wagner_grade": air.wagner_grade,
        "alert_level": air.alert_level,
        "overall_confidence": air.overall_confidence,
        "processed_at": air.processed_at.isoformat() if air.processed_at else None,
        "processing_method": air.processing_method,
    }
    if air.details_json:
        try:
            extra = json.loads(air.details_json)
            if isinstance(extra, dict):
                merged = {**row, **extra}
                merged["alert_level"] = air.alert_level
                merged["overall_confidence"] = air.overall_confidence
                return merged
        except (json.JSONDecodeError, TypeError):
            pass
    return row
