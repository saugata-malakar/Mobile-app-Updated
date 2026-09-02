"""FCM (firebase-admin) + Twilio SMS delivery for in-app notification types."""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

from flask import current_app

logger = logging.getLogger(__name__)

NOTIFICATION_TYPES = frozenset(
    {
        "ALERT_RED",
        "ALERT_AMBER",
        "SESSION_DUE",
        "SESSION_OVERDUE",
        "PRESCRIPTION_READY",
        "TELECONSULT_SCHEDULED",
        "TELECONSULT_CONFIRMED",
        "PAYMENT_DUE",
        "PAYMENT_FAILED",
        "PAYMENT_SUCCESS",
        "CONSENT_REQUIRED",
        "SUBSCRIPTION_EXPIRING",
        "SYSTEM_MESSAGE",
    }
)

_fcm_app = None


def _dry_run() -> bool:
    try:
        return bool(current_app.config.get("NOTIFICATIONS_DRY_RUN"))
    except RuntimeError:
        return os.environ.get("NOTIFICATIONS_DRY_RUN", "").lower() in ("1", "true", "yes")


def _init_firebase():
    global _fcm_app
    if _fcm_app is not None:
        return _fcm_app
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.warning("firebase-admin not installed")
        return None

    cred_path = current_app.config.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get(
        "GOOGLE_APPLICATION_CREDENTIALS"
    )
    cred_json = current_app.config.get("FIREBASE_CREDENTIALS_JSON") or os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if cred_json and not cred_path:
        try:
            info = json.loads(cred_json)
            cred = credentials.Certificate(info)
        except json.JSONDecodeError:
            logger.warning("FIREBASE_CREDENTIALS_JSON is not valid JSON")
            return None
    elif cred_path and os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        return None

    try:
        _fcm_app = firebase_admin.initialize_app(cred)
    except ValueError:
        _fcm_app = firebase_admin.get_app()
    return _fcm_app


def send_fcm_data_message(
    registration_token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> str | None:
    """Returns FCM message id or None on skip/failure."""
    if not registration_token:
        return None
    if _dry_run():
        return "dry-run"

    app = _init_firebase()
    if app is None:
        logger.info("FCM skipped: no firebase credentials")
        return None

    try:
        from firebase_admin import messaging

        msg = messaging.Message(
            token=registration_token,
            notification=messaging.Notification(title=title[:200], body=body[:4000]),
            data={k: str(v)[:1024] for k, v in (data or {}).items()},
            android=messaging.AndroidConfig(priority="high"),
        )
        return messaging.send(msg)
    except Exception as e:
        logger.exception("FCM send failed: %s", e)
        return None


def _e164_phone(raw: str, default_cc: str) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    if digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10 and default_cc:
        digits = default_cc + digits
    if not digits.startswith("+"):
        digits = "+" + digits
    return digits


def send_sms_e164(to_e164: str, body: str) -> str | None:
    if not to_e164 or not body:
        return None
    if _dry_run():
        return "dry-run"

    sid = current_app.config.get("TWILIO_ACCOUNT_SID") or os.environ.get("TWILIO_ACCOUNT_SID")
    token = current_app.config.get("TWILIO_AUTH_TOKEN") or os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = current_app.config.get("TWILIO_FROM_NUMBER") or os.environ.get("TWILIO_FROM_NUMBER")
    if not (sid and token and from_num):
        logger.info("Twilio skipped: missing TWILIO_* env")
        return None

    try:
        from twilio.rest import Client

        client = Client(sid, token)
        msg = client.messages.create(to=to_e164, from_=from_num, body=body[:1400])
        return msg.sid
    except Exception as e:
        logger.exception("Twilio send failed: %s", e)
        return None


def send_sms_to_user_phone(phone: str, body: str) -> str | None:
    cc = str(current_app.config.get("TWILIO_SMS_DEFAULT_COUNTRY_CODE") or os.environ.get("TWILIO_SMS_DEFAULT_COUNTRY_CODE", "91"))
    e164 = _e164_phone(phone, cc)
    if not e164:
        return None
    return send_sms_e164(e164, body)
