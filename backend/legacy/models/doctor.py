import uuid
from datetime import datetime, timezone

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class Doctor(db.Model):
    __tablename__ = "doctors"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), index=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)
    nmc_number = db.Column(db.String(30), unique=True, nullable=False)
    nmc_registration_number = db.Column(db.String(40))
    specialisation = db.Column(db.String(50))
    hospital_name = db.Column(db.String(200))
    hospital_department = db.Column(db.String(120))
    hospital_address = db.Column(db.Text)
    consultation_phone = db.Column(db.String(20))
    available_days = db.Column(db.Text)
    languages = db.Column(db.String(100), default="Bengali,Hindi")
    availability = db.Column(db.Text)
    max_cases_per_day = db.Column(db.Integer, default=20, nullable=False)
    cases_today = db.Column(db.Integer, default=0, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)
    rating = db.Column(db.Float, default=5.0, nullable=False)
    onboarded_at = db.Column(db.DateTime(timezone=True))
    total_consultations = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)

    consultations = db.relationship("Consultation", back_populates="doctor", lazy="dynamic")
    prescriptions = db.relationship("Prescription", back_populates="doctor", lazy="dynamic")
