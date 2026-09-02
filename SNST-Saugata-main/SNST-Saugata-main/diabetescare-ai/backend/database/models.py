import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime,
    JSON, ForeignKey, Text, Float, event
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.types import TypeDecorator, CHAR

Base = declarative_base()


# ── UUID shim (works with SQLite + PostgreSQL) ────────────────────────────────
class GUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return uuid.UUID(str(value))


# ── Auth ──────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    user_id      = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email        = Column(String(200), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role         = Column(String(20), default="field_worker")  # doctor | admin | field_worker
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)


# ── Clinical ──────────────────────────────────────────────────────────────────
class Patient(Base):
    __tablename__ = "patients"
    patient_id            = Column(GUID(), primary_key=True, default=uuid.uuid4)
    pseudonym             = Column(String(64), unique=True, nullable=False)  # HMAC token
    age_band              = Column(String(10))                               # "25-29"
    gender                = Column(String(10))
    district              = Column(String(100))                              # village stripped
    hba1c                 = Column(Float)
    diabetes_duration_years = Column(Integer)
    systolic_bp           = Column(Integer)
    diastolic_bp          = Column(Integer)
    created_at            = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at            = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted            = Column(Boolean, default=False)

    wound_sessions    = relationship("WoundSession",    back_populates="patient", cascade="all, delete-orphan")
    consent_versions  = relationship("ConsentVersion",  back_populates="patient", cascade="all, delete-orphan")
    consultation_notes= relationship("ConsultationNote",back_populates="patient", cascade="all, delete-orphan")
    foot_photos       = relationship("FootPhoto",       back_populates="patient", cascade="all, delete-orphan")
    alert_logs        = relationship("AlertLog",        back_populates="patient", cascade="all, delete-orphan")


class WoundSession(Base):
    __tablename__ = "wound_sessions"
    session_id     = Column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id     = Column(GUID(), ForeignKey("patients.patient_id"), nullable=False, index=True)
    session_date   = Column(DateTime, default=datetime.utcnow)
    severity_grade = Column(Integer)    # Wagner 0-5
    tissue_colour  = Column(String(50))
    wound_area_cm2 = Column(Float)
    created_at     = Column(DateTime, default=datetime.utcnow, index=True)

    patient = relationship("Patient", back_populates="wound_sessions")
    photos  = relationship("FootPhoto", back_populates="session", cascade="all, delete-orphan")


class FootPhoto(Base):
    __tablename__ = "foot_photos"
    photo_id   = Column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id = Column(GUID(), ForeignKey("wound_sessions.session_id"), nullable=False)
    patient_id = Column(GUID(), ForeignKey("patients.patient_id"), nullable=False, index=True)
    photo_data = Column(Text, nullable=False)   # AES-256-GCM: enc_gcm:<b64>
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("WoundSession", back_populates="photos")
    patient = relationship("Patient", back_populates="foot_photos")


class ConsultationNote(Base):
    __tablename__ = "consultation_notes"
    note_id           = Column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id        = Column(GUID(), ForeignKey("patients.patient_id"), nullable=False, index=True)
    free_text         = Column(Text)
    extracted_entities= Column(JSON)  # {wound_location:[], infection_sign:[], treatment_recommendation:[]}
    created_at        = Column(DateTime, default=datetime.utcnow, index=True)

    patient = relationship("Patient", back_populates="consultation_notes")


class Doctor(Base):
    __tablename__ = "doctors"
    doctor_id        = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id          = Column(GUID(), ForeignKey("users.user_id"))
    name             = Column(String(200), nullable=False)
    specialisation   = Column(String(100))
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime, default=datetime.utcnow)


class FieldWorker(Base):
    __tablename__ = "field_workers"
    worker_id  = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id    = Column(GUID(), ForeignKey("users.user_id"))
    name       = Column(String(200), nullable=False)
    district   = Column(String(100))
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Privacy & Compliance ──────────────────────────────────────────────────────
class ConsentVersion(Base):
    __tablename__ = "consent_versions"
    consent_id     = Column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id     = Column(GUID(), ForeignKey("patients.patient_id"), nullable=False, index=True)
    consent_stage  = Column(Integer, nullable=False)       # 1 = clinical use, 2 = research/external
    version        = Column(Integer, nullable=False, default=1)
    consented_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    data_use_scope = Column(JSON, nullable=False)          # dict describing permitted uses
    is_current     = Column(Boolean, default=True, nullable=False)

    patient = relationship("Patient", back_populates="consent_versions")


@event.listens_for(ConsentVersion, "before_update")
def _block_consent_update(mapper, connection, target):
    """ConsentVersion rows are append-only. Version bump creates a new row."""
    raise ValueError(
        "ConsentVersion records are immutable. "
        "Create a new row via POST /consent/record."
    )


class ErasureQueue(Base):
    __tablename__ = "erasure_queue"
    erasure_id     = Column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id     = Column(String(100), nullable=False, index=True)
    requested_at   = Column(DateTime, default=datetime.utcnow, index=True)
    deadline_at    = Column(DateTime)   # requested_at + 72 h
    completed_at   = Column(DateTime)
    status         = Column(String(20), default="pending")  # pending | in_progress | completed | failed
    tables_cleared = Column(JSON)       # ["patients", "wound_sessions", ...]


class ExportLog(Base):
    __tablename__ = "export_logs"
    export_id            = Column(GUID(), primary_key=True, default=uuid.uuid4)
    requested_by         = Column(String(100))
    export_type          = Column(String(50))
    k_anonymity_verified = Column(Boolean, default=False)
    record_count         = Column(Integer)
    created_at           = Column(DateTime, default=datetime.utcnow, index=True)


# ── Audit & Observability ─────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"
    log_id      = Column(GUID(), primary_key=True, default=uuid.uuid4)
    timestamp   = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    user_id     = Column(String(100))
    patient_id  = Column(String(100))
    action      = Column(String(20), nullable=False)   # READ | WRITE | DELETE | LOGIN
    endpoint    = Column(String(200), nullable=False)
    method      = Column(String(10), nullable=False)
    status_code = Column(Integer)
    ip_address  = Column(String(50))


class AlertLog(Base):
    __tablename__ = "alert_logs"
    alert_id   = Column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id = Column(GUID(), ForeignKey("patients.patient_id"), index=True)
    alert_type = Column(String(100))
    severity   = Column(String(20))   # low | medium | high | critical
    message    = Column(Text)
    resolved   = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    patient = relationship("Patient", back_populates="alert_logs")


# ── Teleconsultation ──────────────────────────────────────────────────────────
class TeleconsultBooking(Base):
    __tablename__ = "teleconsult_bookings"
    booking_id  = Column(GUID(), primary_key=True, default=uuid.uuid4)
    patient_id  = Column(GUID(), ForeignKey("patients.patient_id"), index=True)
    doctor_id   = Column(GUID(), ForeignKey("doctors.doctor_id"))
    scheduled_at= Column(DateTime)
    status      = Column(String(20), default="pending")  # pending | confirmed | completed | cancelled
    notes       = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow, index=True)
