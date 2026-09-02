"""Section 5.7 — PUT /alerts/:id/acknowledge (patient)."""
from __future__ import annotations

from flask import Blueprint, g, request

from middleware.auth_middleware import require_auth
from models import Patient
from utils.alert_actions import acknowledge_patient_alert
from utils.response_helper import error

alerts_bp = Blueprint("alerts", __name__)


def _require_patient():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Patient access only", status=403)
    return None


@alerts_bp.put("/<alert_id>/acknowledge")
@require_auth
def put_acknowledge_alert(alert_id: str):
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    data = request.get_json(silent=True) or {}
    note = data.get("note")
    return acknowledge_patient_alert(p, alert_id, note if note is not None else None)
