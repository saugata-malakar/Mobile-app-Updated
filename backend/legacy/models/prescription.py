import uuid
from datetime import datetime, timezone

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class Prescription(db.Model):
    __tablename__ = "prescriptions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_id = db.Column(db.String(36), db.ForeignKey("consultations.id"), unique=True, nullable=False)
    doctor_id = db.Column(db.String(36), db.ForeignKey("doctors.id"), nullable=False)
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False)
    diagnosis = db.Column(db.String(200), nullable=False)
    icd10_code = db.Column(db.String(20))
    medications = db.Column(db.Text, nullable=False)
    instructions = db.Column(db.Text)
    follow_up_days = db.Column(db.Integer, default=7, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)

    consultation = db.relationship("Consultation", back_populates="prescription")
    doctor = db.relationship("Doctor", back_populates="prescriptions")
    patient = db.relationship("Patient", back_populates="prescriptions")
