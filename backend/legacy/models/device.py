import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class Device(db.Model):
    __tablename__ = "devices"
    __table_args__ = (CheckConstraint("owner_type IN ('patient','asha_worker')", name="ck_device_owner_type"),)

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = db.Column(db.String(100), unique=True, nullable=False)
    owner_id = db.Column(db.String(36), nullable=False, index=True)
    owner_type = db.Column(db.String(20), nullable=False)
    platform = db.Column(db.String(10), default="android", nullable=False)
    registered_at = db.Column(db.DateTime(timezone=True), default=_utcnow)
    last_seen = db.Column(db.DateTime(timezone=True))
    fcm_token = db.Column(db.String(512))
