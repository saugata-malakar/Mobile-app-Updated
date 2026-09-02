"""Patient alert acknowledgement (shared by patients + alerts blueprints)."""
from __future__ import annotations

from datetime import datetime, timezone

from models import Alert, Patient, db
from utils.response_helper import error, success
from utils.validators import sanitise_string


def acknowledge_patient_alert(p: Patient, alert_id: str, note: str | None = None):
    row = Alert.query.get(alert_id)
    if not row or row.patient_id != p.id:
        return error("not_found", "Alert not found", status=404)
    row.resolved_at = datetime.now(timezone.utc)
    if note is not None and str(note).strip():
        row.acknowledgement_note = sanitise_string(str(note))[:4000]
    db.session.add(row)
    db.session.commit()
    return success({"acknowledged": True})
