import uuid
from datetime import datetime, timezone

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, index=True)
    user_type = db.Column(db.String(20), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50))
    resource_id = db.Column(db.String(36))
    ip_address = db.Column(db.String(45))
    status_code = db.Column(db.Integer)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, index=True)
