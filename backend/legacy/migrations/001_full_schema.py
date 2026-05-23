"""
Phase A database migration reference (IEC).

The canonical schema is defined in SQLAlchemy models under ``models/``.
For fresh databases, ``db.create_all()`` materializes all tables.

For existing on-disk SQLite files that predate new columns, run a manual
ALTER migration or recreate the dev database. This module documents the
Phase A target and exposes ``describe_phase_a_schema()`` for tooling.
"""

PHASE_A_TABLES = [
    "users",
    "patients",
    "patient_medical_history",
    "wound_sites",
    "consents",
    "monitoring_sessions",
    "photographs",
    "ai_results",
    "alerts",
    "asha_workers",
    "asha_patient_assignments",
    "asha_commissions",
    "asha_training_modules",
    "doctors",
    "doctor_patient_assignments",
    "teleconsult_requests",
    "prescriptions",
    "subscription_tiers",
    "subscriptions",
    "payment_transactions",
    "session_schedule",
    "notifications",
    "notification_preferences",
    "audit_logs",
    "research_exports",
    "app_config",
]


def describe_phase_a_schema():
    return {
        "tables_documented": PHASE_A_TABLES,
        "note": "ORM models are source of truth; legacy tables screenings, consultations, commissions, devices, admins remain.",
    }
