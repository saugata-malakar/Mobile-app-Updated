"""
Add Phase C4 teleconsult columns to teleconsult_requests (SQLite, idempotent).

  PYTHONPATH=. python3 migrations/upgrade_teleconsult_requests_c4.py
"""
from __future__ import annotations

from sqlalchemy import inspect, text

from app import app, db


def _columns() -> set[str]:
    insp = inspect(db.engine)
    return {c["name"] for c in insp.get_columns("teleconsult_requests")}


def upgrade() -> list[str]:
    if db.engine.dialect.name != "sqlite":
        return []
    insp = inspect(db.engine)
    if "teleconsult_requests" not in insp.get_table_names():
        return []
    existing = _columns()
    alters: list[tuple[str, str]] = []
    specs = [
        ("patient_concern_en", "ALTER TABLE teleconsult_requests ADD COLUMN patient_concern_en TEXT"),
        ("patient_concern_bn", "ALTER TABLE teleconsult_requests ADD COLUMN patient_concern_bn TEXT"),
        ("preferred_callback_time", "ALTER TABLE teleconsult_requests ADD COLUMN preferred_callback_time TEXT"),
        (
            "estimated_callback_at",
            "ALTER TABLE teleconsult_requests ADD COLUMN estimated_callback_at TEXT",
        ),
        ("scheduled_at", "ALTER TABLE teleconsult_requests ADD COLUMN scheduled_at TEXT"),
        ("assigned_at", "ALTER TABLE teleconsult_requests ADD COLUMN assigned_at TEXT"),
        ("actual_call_at", "ALTER TABLE teleconsult_requests ADD COLUMN actual_call_at TEXT"),
        ("call_duration_minutes", "ALTER TABLE teleconsult_requests ADD COLUMN call_duration_minutes INTEGER"),
        ("doctor_notes", "ALTER TABLE teleconsult_requests ADD COLUMN doctor_notes TEXT"),
        ("patient_rating", "ALTER TABLE teleconsult_requests ADD COLUMN patient_rating INTEGER"),
        ("patient_feedback", "ALTER TABLE teleconsult_requests ADD COLUMN patient_feedback TEXT"),
        ("cancelled_at", "ALTER TABLE teleconsult_requests ADD COLUMN cancelled_at TEXT"),
        ("prescription_json", "ALTER TABLE teleconsult_requests ADD COLUMN prescription_json TEXT"),
    ]
    for name, sql in specs:
        if name not in existing:
            alters.append((name, sql))
    ran: list[str] = []
    for _name, sql in alters:
        db.session.execute(text(sql))
        ran.append(sql)
    if ran:
        db.session.commit()
    return ran


def main() -> None:
    with app.app_context():
        ran = upgrade()
        for s in ran:
            print("executed:", s)
        if not ran:
            print("teleconsult_requests already has C4 columns; nothing to do.")


if __name__ == "__main__":
    main()
