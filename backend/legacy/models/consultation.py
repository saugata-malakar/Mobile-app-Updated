import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class Consultation(db.Model):
    __tablename__ = "consultations"
    __table_args__ = (
        CheckConstraint("mode IN ('async','scheduled','instant')", name="ck_consultation_mode"),
        CheckConstraint(
            "status IN ('pending','assigned','in_progress','completed','cancelled')",
            name="ck_consultation_status",
        ),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    screening_id = db.Column(db.String(36), db.ForeignKey("screenings.id"), nullable=False, unique=True, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = db.Column(db.String(36), db.ForeignKey("doctors.id"), nullable=True, index=True)
    mode = db.Column(db.String(20), nullable=False)
    time_slot = db.Column(db.String(50))
    status = db.Column(db.String(20), default="pending", nullable=False)
    queue_position = db.Column(db.Integer)
    assigned_at = db.Column(db.DateTime(timezone=True))
    completed_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)

    screening = db.relationship("Screening", back_populates="consultation")
    patient = db.relationship("Patient", back_populates="consultations")
    doctor = db.relationship("Doctor", back_populates="consultations")
    prescription = db.relationship("Prescription", back_populates="consultation", uselist=False)
