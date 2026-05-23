"""Add doctor web-dashboard columns to legacy SQLite doctors table."""
from sqlalchemy import inspect, text

from models import db


def upgrade_doctors_web():
    insp = inspect(db.engine)
    if "doctors" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("doctors")}
    alters = [
        ("user_id", "ALTER TABLE doctors ADD COLUMN user_id TEXT"),
        ("nmc_registration_number", "ALTER TABLE doctors ADD COLUMN nmc_registration_number TEXT"),
        ("hospital_name", "ALTER TABLE doctors ADD COLUMN hospital_name TEXT"),
        ("hospital_department", "ALTER TABLE doctors ADD COLUMN hospital_department TEXT"),
        ("hospital_address", "ALTER TABLE doctors ADD COLUMN hospital_address TEXT"),
        ("consultation_phone", "ALTER TABLE doctors ADD COLUMN consultation_phone TEXT"),
        ("available_days", "ALTER TABLE doctors ADD COLUMN available_days TEXT"),
        ("onboarded_at", "ALTER TABLE doctors ADD COLUMN onboarded_at TEXT"),
        ("total_consultations", "ALTER TABLE doctors ADD COLUMN total_consultations INTEGER DEFAULT 0"),
    ]
    for col, stmt in alters:
        if col not in existing:
            db.session.execute(text(stmt))
    db.session.commit()
