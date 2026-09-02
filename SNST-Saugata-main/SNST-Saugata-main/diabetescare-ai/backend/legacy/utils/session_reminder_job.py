"""Daily session reminders (08:00 IST): advance, due today, overdue on session_schedule."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from models import NotificationPreference, Patient, SessionSchedule, db
from utils.notification_dispatch import send_notification

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


def _today_ist() -> date:
    return datetime.now(IST).date()


def _parse_days_before(pref: NotificationPreference | None) -> list[int]:
    raw = (pref.session_reminder_days_before if pref else None) or "[1]"
    try:
        arr = json.loads(raw)
        if isinstance(arr, list):
            return sorted({int(x) for x in arr if str(x).isdigit() and int(x) > 0})
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return [1]


def _session_label(st: str) -> str:
    m = {
        "WOUND_MONITORING": "Wound monitoring",
        "SKIN_ASSESSMENT": "Skin assessment",
        "CONTRIBUTING_FACTOR": "Contributing factor session",
    }
    return m.get(st, st)


def run_session_reminders() -> dict[str, int]:
    today = _today_ist()
    today_s = today.isoformat()

    stats = {"advance": 0, "due_today": 0, "overdue": 0, "skipped_no_user": 0}

    rows = (
        SessionSchedule.query.filter(
            SessionSchedule.status.notin_(["COMPLETED", "SKIPPED", "CANCELLED"]),
        )
        .order_by(SessionSchedule.scheduled_date.asc())
        .all()
    )

    for row in rows:
        patient = Patient.query.get(row.patient_id)
        if not patient or not patient.user_id:
            stats["skipped_no_user"] += 1
            continue

        pref = NotificationPreference.query.filter_by(user_id=patient.user_id).first()
        days_list = _parse_days_before(pref)

        try:
            sched = date.fromisoformat(str(row.scheduled_date)[:10])
        except ValueError:
            continue

        advance_days = [d for d in days_list if sched - timedelta(days=d) == today]
        if advance_days and row.reminder_1_sent_at is None:
            d0 = advance_days[0]
            send_notification(
                recipient_user_id=patient.user_id,
                notification_type="SESSION_DUE",
                title_en="Session reminder",
                body_en=f"{_session_label(row.session_type)} is due in {d0} day(s), on {row.scheduled_date}.",
                channel="BOTH",
                title_bn="সেশন অনুস্মারক",
                body_bn=None,
                deep_link="PatientHome",
                data={"session_schedule_id": row.id, "phase": "advance", "days_before": d0},
                auto_commit=False,
            )
            row.reminder_1_sent_at = datetime.now(timezone.utc)
            stats["advance"] += 1

        if str(row.scheduled_date)[:10] == today_s and row.reminder_2_sent_at is None:
            send_notification(
                recipient_user_id=patient.user_id,
                notification_type="SESSION_DUE",
                title_en="Session due today",
                body_en=f"{_session_label(row.session_type)} is scheduled today ({row.scheduled_date}).",
                channel="BOTH",
                title_bn="আজ সেশন",
                body_bn=None,
                deep_link="PatientHome",
                data={"session_schedule_id": row.id, "phase": "due_today"},
                auto_commit=False,
            )
            row.reminder_2_sent_at = datetime.now(timezone.utc)
            row.status = "DUE_TODAY"
            stats["due_today"] += 1

        if sched < today and row.overdue_alert_sent_at is None:
            if pref and not pref.overdue_reminder_enabled:
                pass
            else:
                send_notification(
                    recipient_user_id=patient.user_id,
                    notification_type="SESSION_OVERDUE",
                    title_en="Session overdue",
                    body_en=f"{_session_label(row.session_type)} was due on {row.scheduled_date}. Please complete it in the app.",
                    channel="BOTH",
                    title_bn="সেশন বিলম্বিত",
                    body_bn=None,
                    deep_link="PatientHome",
                    data={"session_schedule_id": row.id},
                    auto_commit=False,
                )
                row.overdue_alert_sent_at = datetime.now(timezone.utc)
                row.status = "OVERDUE"
                stats["overdue"] += 1

        db.session.commit()

    return stats
