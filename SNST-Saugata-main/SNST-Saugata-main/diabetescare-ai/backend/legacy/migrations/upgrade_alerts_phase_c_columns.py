"""
Add Phase C1 alert columns to an existing SQLite DB (idempotent).

Run once from backend root:

  PYTHONPATH=. python3 migrations/upgrade_alerts_phase_c_columns.py

Fresh installs that use db.create_all() do not need this.
"""
from __future__ import annotations

from sqlalchemy import inspect, text

from app import app, db


def _sqlite_alerts_columns() -> set[str]:
    insp = inspect(db.engine)
    return {c["name"] for c in insp.get_columns("alerts")}


def upgrade() -> list[str]:
    """Apply missing ALTERs; returns list of statements executed."""
    if db.engine.dialect.name != "sqlite":
        raise RuntimeError("This helper targets SQLite dev DBs; use your own migration for Postgres.")
    existing = _sqlite_alerts_columns()
    alters: list[tuple[str, str]] = []
    if "message_patient_bn" not in existing:
        alters.append(("message_patient_bn", "ALTER TABLE alerts ADD COLUMN message_patient_bn TEXT"))
    if "message_doctor_en" not in existing:
        alters.append(("message_doctor_en", "ALTER TABLE alerts ADD COLUMN message_doctor_en TEXT"))
    if "acknowledgement_note" not in existing:
        alters.append(("acknowledgement_note", "ALTER TABLE alerts ADD COLUMN acknowledgement_note TEXT"))
    if "escalation_level" not in existing:
        alters.append(
            ("escalation_level", "ALTER TABLE alerts ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0")
        )
    if "escalation_at" not in existing:
        alters.append(("escalation_at", "ALTER TABLE alerts ADD COLUMN escalation_at TEXT"))
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
            print("alerts table already has Phase C columns; nothing to do.")


if __name__ == "__main__":
    main()
