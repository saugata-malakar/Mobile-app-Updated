import uuid
from datetime import datetime, timezone

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class AshaWorker(db.Model):
    __tablename__ = "asha_workers"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), index=True)
    worker_id = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(15), nullable=False)
    pin_hash = db.Column(db.String(200), nullable=False)
    village = db.Column(db.String(100), nullable=False)
    district = db.Column(db.String(100))
    asha_id_number = db.Column(db.String(40), unique=True)
    phc_name = db.Column(db.String(200))
    block_name = db.Column(db.String(120))
    villages_covered = db.Column(db.Text)
    training_completed = db.Column(db.Boolean, default=False)
    training_completed_at = db.Column(db.DateTime(timezone=True))
    training_score = db.Column(db.Float)
    supervisor_name = db.Column(db.String(120))
    supervisor_phone = db.Column(db.String(15))
    bank_account_encrypted = db.Column(db.Text)
    bank_ifsc = db.Column(db.String(20))
    state = db.Column(db.String(80), default="West Bengal")
    device_id = db.Column(db.String(100))
    active = db.Column(db.Boolean, default=True, nullable=False)
    total_screenings = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    screenings = db.relationship("Screening", back_populates="asha_worker", lazy="dynamic")
