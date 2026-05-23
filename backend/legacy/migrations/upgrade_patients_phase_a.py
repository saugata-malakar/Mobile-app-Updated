"""Add Phase A patient columns to legacy SQLite patients table (idempotent)."""
from sqlalchemy import inspect, text

from models import db


def upgrade_patients_phase_a():
    insp = inspect(db.engine)
    if "patients" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("patients")}
    alters = [
        ("user_id", "ALTER TABLE patients ADD COLUMN user_id TEXT"),
        ("block", "ALTER TABLE patients ADD COLUMN block TEXT"),
        ("pin_code", "ALTER TABLE patients ADD COLUMN pin_code TEXT"),
        ("state", "ALTER TABLE patients ADD COLUMN state TEXT DEFAULT 'West Bengal'"),
        ("date_of_birth", "ALTER TABLE patients ADD COLUMN date_of_birth TEXT"),
        ("emergency_contact_name", "ALTER TABLE patients ADD COLUMN emergency_contact_name TEXT"),
        ("emergency_contact_phone", "ALTER TABLE patients ADD COLUMN emergency_contact_phone TEXT"),
        ("preferred_language", "ALTER TABLE patients ADD COLUMN preferred_language TEXT DEFAULT 'en'"),
        ("password_hash", "ALTER TABLE patients ADD COLUMN password_hash TEXT"),
        (
            "is_research_participant",
            "ALTER TABLE patients ADD COLUMN is_research_participant INTEGER NOT NULL DEFAULT 0",
        ),
        (
            "is_commercial_subscriber",
            "ALTER TABLE patients ADD COLUMN is_commercial_subscriber INTEGER NOT NULL DEFAULT 0",
        ),
        ("created_by_asha_id", "ALTER TABLE patients ADD COLUMN created_by_asha_id TEXT"),
        ("research_enrolled_at", "ALTER TABLE patients ADD COLUMN research_enrolled_at TEXT"),
    ]
    ran = False
    for col, stmt in alters:
        if col not in existing:
            db.session.execute(text(stmt))
            ran = True
    if ran:
        db.session.commit()
