"""
Phase C5: notifications / notification_preferences / session_schedule columns (SQLite, idempotent).

  PYTHONPATH=. python3 migrations/upgrade_notifications_c5.py
"""
from __future__ import annotations

from sqlalchemy import inspect, text

from app import app, db


def _cols(table: str) -> set[str]:
    return {c["name"] for c in inspect(db.engine).get_columns(table)}


def upgrade() -> list[str]:
    if db.engine.dialect.name != "sqlite":
        raise RuntimeError("SQLite-only helper.")
    ran: list[str] = []

    n = _cols("notifications")
    specs_n = [
        ("title_bn", "ALTER TABLE notifications ADD COLUMN title_bn TEXT"),
        ("body_bn", "ALTER TABLE notifications ADD COLUMN body_bn TEXT"),
        ("deep_link", "ALTER TABLE notifications ADD COLUMN deep_link TEXT"),
        ("data", "ALTER TABLE notifications ADD COLUMN data TEXT"),
        ("fcm_message_id", "ALTER TABLE notifications ADD COLUMN fcm_message_id TEXT"),
        ("sms_message_id", "ALTER TABLE notifications ADD COLUMN sms_message_id TEXT"),
        ("action_taken", "ALTER TABLE notifications ADD COLUMN action_taken INTEGER NOT NULL DEFAULT 0"),
    ]
    for name, sql in specs_n:
        if name not in n:
            db.session.execute(text(sql))
            ran.append(sql)

    p = _cols("notification_preferences")
    specs_p = [
        ("session_reminder_days_before", "ALTER TABLE notification_preferences ADD COLUMN session_reminder_days_before TEXT DEFAULT '[1]'"),
        ("overdue_reminder_enabled", "ALTER TABLE notification_preferences ADD COLUMN overdue_reminder_enabled INTEGER NOT NULL DEFAULT 1"),
        ("overdue_reminder_after_days", "ALTER TABLE notification_preferences ADD COLUMN overdue_reminder_after_days INTEGER NOT NULL DEFAULT 2"),
        ("prescription_notifications_enabled", "ALTER TABLE notification_preferences ADD COLUMN prescription_notifications_enabled INTEGER NOT NULL DEFAULT 1"),
        ("marketing_enabled", "ALTER TABLE notification_preferences ADD COLUMN marketing_enabled INTEGER NOT NULL DEFAULT 0"),
        ("language", "ALTER TABLE notification_preferences ADD COLUMN language TEXT DEFAULT 'en'"),
    ]
    for name, sql in specs_p:
        if name not in p:
            db.session.execute(text(sql))
            ran.append(sql)

    s = _cols("session_schedule")
    specs_s = [
        ("reminder_1_sent_at", "ALTER TABLE session_schedule ADD COLUMN reminder_1_sent_at TEXT"),
        ("reminder_2_sent_at", "ALTER TABLE session_schedule ADD COLUMN reminder_2_sent_at TEXT"),
        ("overdue_alert_sent_at", "ALTER TABLE session_schedule ADD COLUMN overdue_alert_sent_at TEXT"),
        ("completed_session_id", "ALTER TABLE session_schedule ADD COLUMN completed_session_id TEXT"),
    ]
    for name, sql in specs_s:
        if name not in s:
            db.session.execute(text(sql))
            ran.append(sql)

    if ran:
        db.session.commit()
    return ran


def main() -> None:
    with app.app_context():
        ran = upgrade()
        for x in ran:
            print("executed:", x)
        if not ran:
            print("C5 notification columns already present.")


if __name__ == "__main__":
    main()
