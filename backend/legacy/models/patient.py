import uuid
from datetime import datetime, timezone

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class Patient(db.Model):
    __tablename__ = "patients"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), index=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(15), unique=True, nullable=False, index=True)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(10), nullable=False)
    village = db.Column(db.String(100), nullable=False)
    district = db.Column(db.String(100))
    block = db.Column(db.String(100))
    pin_code = db.Column(db.String(12))
    state = db.Column(db.String(80), default="West Bengal")
    date_of_birth = db.Column(db.String(32))
    emergency_contact_name = db.Column(db.String(120))
    emergency_contact_phone = db.Column(db.String(15))
    preferred_language = db.Column(db.String(5), default="en")
    password_hash = db.Column(db.String(200))
    is_research_participant = db.Column(db.Boolean, default=False)
    is_commercial_subscriber = db.Column(db.Boolean, default=False)
    created_by_asha_id = db.Column(db.String(36), db.ForeignKey("asha_workers.id"))
    research_enrolled_at = db.Column(db.DateTime(timezone=True))
    known_conditions = db.Column(db.Text)
    allergies = db.Column(db.Text)
    abha_id = db.Column(db.String(20), unique=True)
    consent_given_at = db.Column(db.DateTime(timezone=True))
    last_login = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    screenings = db.relationship("Screening", back_populates="patient", lazy="dynamic")
    consultations = db.relationship("Consultation", back_populates="patient", lazy="dynamic")
    prescriptions = db.relationship("Prescription", back_populates="patient", lazy="dynamic")
