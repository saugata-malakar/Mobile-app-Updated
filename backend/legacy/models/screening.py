import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class Screening(db.Model):
    __tablename__ = "screenings"
    __table_args__ = (
        CheckConstraint("condition_type IN ('skin','eye','wound')", name="ck_screening_condition"),
        CheckConstraint("risk_level IN ('low','medium','high')", name="ck_screening_risk"),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    asha_id = db.Column(db.String(36), db.ForeignKey("asha_workers.id"), nullable=True, index=True)
    condition_type = db.Column(db.String(10), nullable=False)
    risk_level = db.Column(db.String(10), nullable=False)
    ai_result = db.Column(db.Text)
    model_source = db.Column(db.String(30))
    confidence = db.Column(db.Float)
    photo_data = db.Column(db.Text)
    quality_score = db.Column(db.Float)
    consent_timestamp = db.Column(db.DateTime(timezone=True), nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)

    patient = db.relationship("Patient", back_populates="screenings")
    asha_worker = db.relationship("AshaWorker", back_populates="screenings")
    consultation = db.relationship("Consultation", back_populates="screening", uselist=False)
    commissions = db.relationship("Commission", back_populates="screening", lazy="dynamic")
