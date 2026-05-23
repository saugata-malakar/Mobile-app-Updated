import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class Commission(db.Model):
    __tablename__ = "commissions"
    __table_args__ = (CheckConstraint("commission_type IN ('screening','referral')", name="ck_commission_type"),)

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asha_id = db.Column(db.String(36), db.ForeignKey("asha_workers.id"), nullable=False, index=True)
    screening_id = db.Column(db.String(36), db.ForeignKey("screenings.id"), nullable=False, index=True)
    amount = db.Column(db.Float, nullable=False)
    commission_type = db.Column(db.String(20), nullable=False)
    paid_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)

    asha_worker = db.relationship("AshaWorker", back_populates="commissions")
    screening = db.relationship("Screening", back_populates="commissions")
