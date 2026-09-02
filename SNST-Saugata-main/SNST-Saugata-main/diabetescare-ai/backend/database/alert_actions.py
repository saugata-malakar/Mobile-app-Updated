import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.database.models import Alert, Patient
from backend.utils.legacy_response import error, success
from backend.utils.validators import sanitise_string

def acknowledge_patient_alert(db: Session, p: Patient, alert_id: str, note: str | None = None):
    try:
        alert_uuid = uuid.UUID(alert_id) if isinstance(alert_id, str) and len(alert_id) == 36 else alert_id
    except ValueError:
        return error("validation_error", "Invalid alert ID format", status=400)
        
    row = db.query(Alert).filter_by(alert_id=alert_uuid).first()
    if not row or row.patient_id != p.patient_id:
        return error("not_found", "Alert not found", status=404)
        
    row.acknowledged_at = datetime.now(timezone.utc)
    if hasattr(row, "resolved_at"):
        row.resolved_at = datetime.now(timezone.utc)
        
    if note is not None and str(note).strip() and hasattr(row, "acknowledgement_note"):
        row.acknowledgement_note = sanitise_string(str(note))[:4000]
        
    db.commit()
    return success({"acknowledged": True})
