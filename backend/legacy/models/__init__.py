from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .user import User  # noqa: E402
from .admin import Admin  # noqa: E402
from .asha_worker import AshaWorker  # noqa: E402
from .audit_log import AuditLog  # noqa: E402
from .consultation import Consultation  # noqa: E402
from .device import Device  # noqa: E402
from .doctor import Doctor  # noqa: E402
from .patient import Patient  # noqa: E402
from .prescription import Prescription  # noqa: E402
from .screening import Screening  # noqa: E402
from .phase_a_tables import (  # noqa: E402
    AiResult,
    Alert,
    AppConfig,
    AshaPatientAssignment,
    AshaTrainingModule,
    DoctorPatientAssignment,
    MonitoringSession,
    Notification,
    NotificationPreference,
    PatientConsent,
    PatientMedicalHistory,
    Photograph,
    ResearchExport,
    SessionSchedule,
    TeleconsultRequest,
    WoundSite,
)

__all__ = [
    "db",
    "User",
    "Admin",
    "AshaWorker",
    "AuditLog",
    "Consultation",
    "Device",
    "Doctor",
    "Patient",
    "Prescription",
    "Screening",
    "AppConfig",
    "PatientMedicalHistory",
    "WoundSite",
    "PatientConsent",
    "MonitoringSession",
    "Photograph",
    "AiResult",
    "Alert",
    "AshaPatientAssignment",
    "AshaTrainingModule",
    "DoctorPatientAssignment",
    "TeleconsultRequest",
    "SessionSchedule",
    "Notification",
    "NotificationPreference",
    "ResearchExport",
]
