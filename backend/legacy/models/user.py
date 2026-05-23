import uuid
from datetime import datetime, timezone

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = db.Column(db.String(15), unique=True, nullable=False, index=True)
    hashed_password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)
    last_login_at = db.Column(db.DateTime(timezone=True))
    device_id = db.Column(db.String(120))
    fcm_token = db.Column(db.String(512))
    preferred_language = db.Column(db.String(5), default="en")
