"""Create `notifications` rows and dispatch FCM + SMS per type and user preferences."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from flask import current_app

from models import Notification, NotificationPreference, Patient, User, db
from utils.push_sms import NOTIFICATION_TYPES, send_fcm_data_message, send_sms_to_user_phone

logger = logging.getLogger(__name__)


def _utcnow():
    return datetime.now(timezone.utc)


def _default_pref_for_user(user_id: str) -> NotificationPreference:
    return NotificationPreference(
        id=str(uuid.uuid4()),
        user_id=user_id,
        session_reminder_days_before="[1]",
        session_reminder_time="09:00",
        overdue_reminder_enabled=True,
        overdue_reminder_after_days=2,
        alert_sms_enabled=True,
        alert_push_enabled=True,
        payment_notifications_enabled=True,
        prescription_notifications_enabled=True,
        marketing_enabled=False,
        language="en",
    )


def _get_or_create_pref(user_id: str) -> NotificationPreference:
    pref = NotificationPreference.query.filter_by(user_id=user_id).first()
    if pref:
        return pref
    pref = _default_pref_for_user(user_id)
    db.session.add(pref)
    db.session.flush()
    return pref


def _resolve_send(
    notification_type: str,
    channel: str,
    pref: NotificationPreference,
) -> tuple[bool, bool]:
    """Returns (send_push, send_sms) honoring requested channel and preferences."""
    want_push = channel in ("PUSH", "BOTH")
    want_sms = channel in ("SMS", "BOTH")

    push_ok = want_push and pref.alert_push_enabled
    sms_ok = want_sms and pref.alert_sms_enabled

    if notification_type in ("ALERT_RED", "ALERT_AMBER"):
        return push_ok, sms_ok

    if notification_type in ("SESSION_DUE", "SESSION_OVERDUE"):
        if notification_type == "SESSION_OVERDUE" and not pref.overdue_reminder_enabled:
            return False, False
        return push_ok, sms_ok

    if notification_type in ("PAYMENT_DUE", "PAYMENT_FAILED", "PAYMENT_SUCCESS"):
        if not pref.payment_notifications_enabled:
            return False, False
        return push_ok, sms_ok

    if notification_type == "PRESCRIPTION_READY":
        if not pref.prescription_notifications_enabled:
            return False, False
        return push_ok, sms_ok

    if notification_type in ("TELECONSULT_SCHEDULED", "TELECONSULT_CONFIRMED", "CONSENT_REQUIRED", "SUBSCRIPTION_EXPIRING"):
        return push_ok, sms_ok

    if notification_type == "SYSTEM_MESSAGE":
        return push_ok, sms_ok

    return push_ok, sms_ok


def send_notification(
    *,
    recipient_user_id: str,
    notification_type: str,
    title_en: str,
    body_en: str,
    channel: str = "BOTH",
    title_bn: str | None = None,
    body_bn: str | None = None,
    deep_link: str | None = None,
    data: dict[str, Any] | None = None,
    auto_commit: bool = True,
) -> Notification | None:
    """
    Persist a notification and send FCM + SMS when enabled for this type.
    Returns the ORM row (committed).
    """
    if notification_type not in NOTIFICATION_TYPES:
        raise ValueError(f"invalid notification_type: {notification_type}")
    if channel not in ("PUSH", "SMS", "BOTH"):
        raise ValueError(f"invalid channel: {channel}")

    user = User.query.get(recipient_user_id)
    if not user:
        logger.warning("send_notification: user %s not found", recipient_user_id)
        return None

    pref = _get_or_create_pref(recipient_user_id)
    do_push, do_sms = _resolve_send(notification_type, channel, pref)

    lang = (pref.language or "en").lower()
    title_use = title_en if lang != "bn" else (title_bn or title_en)
    body_use = body_en if lang != "bn" else (body_bn or body_en)

    row = Notification(
        id=str(uuid.uuid4()),
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        title_en=title_en[:200],
        title_bn=(title_bn or "")[:200] if title_bn else None,
        body_en=body_en,
        body_bn=body_bn,
        deep_link=deep_link,
        data=json.dumps(data) if data is not None else None,
        channel=channel,
        sent_at=_utcnow(),
    )
    db.session.add(row)
    db.session.flush()

    fcm_id = None
    sms_id = None
    if do_push and user.fcm_token:
        fcm_id = send_fcm_data_message(
            user.fcm_token,
            title_use[:200],
            body_use[:4000],
            data={**(data or {}), "notification_id": row.id, "type": notification_type},
        )
    if do_sms and user.phone_number:
        sms_id = send_sms_to_user_phone(user.phone_number, f"{title_use}: {body_use}")[:120]

    row.fcm_message_id = fcm_id
    row.sms_message_id = sms_id
    if auto_commit:
        db.session.commit()
    else:
        db.session.flush()
    return row


def notify_patient_alert(patient_id: str, alert_level: str, message_en: str) -> None:
    """Called from alert_engine when a new alert is generated."""
    p = Patient.query.get(patient_id)
    if not p or not p.user_id:
        logger.info("notify_patient_alert: no user for patient %s", patient_id)
        return
    ntype = "ALERT_RED" if str(alert_level).upper() == "RED" else "ALERT_AMBER"
    title = "Foot care alert" if ntype == "ALERT_AMBER" else "Urgent foot care alert"
    send_notification(
        recipient_user_id=p.user_id,
        notification_type=ntype,
        title_en=title,
        body_en=message_en[:8000],
        channel="BOTH",
        title_bn="পা যত্ন সতর্কতা" if ntype == "ALERT_AMBER" else "জরুরি পা যত্ন সতর্কতা",
        body_bn=None,
        deep_link="AlertDetail",
        data={"patient_id": patient_id, "alert_level": alert_level},
    )


def notify_alert_escalation(patient_id: str, alert_id: str) -> None:
    p = Patient.query.get(patient_id)
    if not p or not p.user_id:
        return
    send_notification(
        recipient_user_id=p.user_id,
        notification_type="SYSTEM_MESSAGE",
        title_en="Alert escalation",
        body_en=f"Alert {alert_id} was escalated because it was not acknowledged in time. Please open the app.",
        channel="BOTH",
        title_bn="সতর্কতা এস্কেলেশন",
        body_bn=None,
        deep_link="Alerts",
        data={"alert_id": alert_id, "patient_id": patient_id},
    )


def notify_prescription_ready(user_id: str, prescription_id: str, summary: str = "") -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="PRESCRIPTION_READY",
        title_en="Prescription ready",
        body_en=summary or "Your prescription is available in the app.",
        channel="BOTH",
        title_bn="প্রেসক্রিপশন প্রস্তুত",
        deep_link="PrescriptionDetail",
        data={"prescription_id": prescription_id},
    )


def notify_teleconsult_scheduled(user_id: str, teleconsult_id: str, when_text: str) -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="TELECONSULT_SCHEDULED",
        title_en="Teleconsult scheduled",
        body_en=f"Phone callback booked: {when_text}",
        channel="BOTH",
        title_bn="টেলিকনসাল্ট নির্ধারিত",
        deep_link="QueueStatus",
        data={"teleconsult_id": teleconsult_id},
    )


def notify_teleconsult_confirmed(user_id: str, teleconsult_id: str) -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="TELECONSULT_CONFIRMED",
        title_en="Teleconsult confirmed",
        body_en="Your phone callback has been confirmed.",
        channel="BOTH",
        title_bn="টেলিকনসাল্ট নিশ্চিত",
        data={"teleconsult_id": teleconsult_id},
    )


def notify_payment_due(user_id: str, amount_rs: float, due_text: str) -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="PAYMENT_DUE",
        title_en="Payment due",
        body_en=f"Rs. {amount_rs:.0f} — {due_text}",
        channel="BOTH",
        title_bn="পেমেন্ট বাকি",
        data={"amount_rs": amount_rs},
    )


def notify_payment_failed(user_id: str, reason: str) -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="PAYMENT_FAILED",
        title_en="Payment failed",
        body_en=reason or "Your payment could not be processed.",
        channel="BOTH",
        title_bn="পেমেন্ট ব্যর্থ",
    )


def notify_payment_success(user_id: str, detail: str = "") -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="PAYMENT_SUCCESS",
        title_en="Payment received",
        body_en=detail or "Thank you — your payment was successful.",
        channel="BOTH",
        title_bn="পেমেন্ট সফল",
    )


def notify_consent_required(user_id: str, module: str) -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="CONSENT_REQUIRED",
        title_en="Consent required",
        body_en=f"Please review consent for: {module}.",
        channel="BOTH",
        title_bn="সম্মতি প্রয়োজন",
        data={"module": module},
    )


def notify_subscription_expiring(user_id: str, expires_on: str) -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="SUBSCRIPTION_EXPIRING",
        title_en="Subscription expiring",
        body_en=f"Your plan ends on {expires_on}. Renew to keep wound monitoring.",
        channel="BOTH",
        title_bn="সাবস্ক্রিপশন শেষ হচ্ছে",
        data={"expires_on": expires_on},
    )


def notify_system_message(user_id: str, title_en: str, body_en: str, data: dict | None = None) -> None:
    send_notification(
        recipient_user_id=user_id,
        notification_type="SYSTEM_MESSAGE",
        title_en=title_en,
        body_en=body_en,
        channel="BOTH",
        data=data,
    )
