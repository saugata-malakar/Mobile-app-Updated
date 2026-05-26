"""Section 5.12 — notifications list, read, preferences, device token (FCM on users table)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, request

from middleware.auth_middleware import require_auth
from models import Device, Notification, NotificationPreference, Patient, User, db
from utils.response_helper import error, success
from utils.validators import sanitise_string

notifications_bp = Blueprint("notifications", __name__)


def _require_patient():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Patient access only", status=403)
    return None


def _serialize_notification(n: Notification) -> dict:
    data = None
    if n.data:
        try:
            data = json.loads(n.data)
        except json.JSONDecodeError:
            data = n.data
    return {
        "id": n.id,
        "notification_type": n.notification_type,
        "title_en": n.title_en,
        "title_bn": n.title_bn,
        "body_en": n.body_en,
        "body_bn": n.body_bn,
        "deep_link": n.deep_link,
        "data": data,
        "channel": n.channel,
        "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "action_taken": bool(n.action_taken),
    }


def _serialize_preferences(pref: NotificationPreference) -> dict:
    return {
        "session_reminder_days_before": pref.session_reminder_days_before or "[1]",
        "session_reminder_time": pref.session_reminder_time or "09:00",
        "overdue_reminder_enabled": pref.overdue_reminder_enabled,
        "overdue_reminder_after_days": pref.overdue_reminder_after_days,
        "alert_sms_enabled": pref.alert_sms_enabled,
        "alert_push_enabled": pref.alert_push_enabled,
        "prescription_notifications_enabled": pref.prescription_notifications_enabled,
        "marketing_enabled": pref.marketing_enabled,
        "language": pref.language or "en",
    }


@notifications_bp.post("/device-token")
@require_auth
def register_device_token():
    """Store FCM token on `users.fcm_token` (and mirror on Device for X-Device-ID)."""
    data = request.get_json(silent=True) or {}
    token = sanitise_string(str(data.get("fcm_token", data.get("token", ""))))
    if not token:
        return error("validation_error", "fcm_token required", status=400)

    ut = getattr(g, "user_type", None)
    uid = g.current_user.id

    if ut == "patient":
        p: Patient = g.current_user
        if not p.user_id:
            return error(
                "validation_error",
                "Patient account must be linked to a user record to store FCM token; register with password.",
                status=400,
            )
        user = User.query.get(p.user_id)
        if not user:
            return error("validation_error", "User row not found", status=400)
        user.fcm_token = token[:512]
        db.session.add(user)

    device_id = request.headers.get("X-Device-ID")
    if device_id:
        dev = Device.query.filter_by(device_id=device_id).first()
        if dev:
            dev.fcm_token = token[:512]
            dev.last_seen = datetime.now(timezone.utc)
        else:
            ot = "patient" if ut == "patient" else "asha_worker"
            db.session.add(
                Device(
                    id=str(uuid.uuid4()),
                    device_id=device_id,
                    owner_id=uid,
                    owner_type=ot,
                    platform="android",
                    fcm_token=token[:512],
                    last_seen=datetime.now(timezone.utc),
                )
            )
    elif ut != "patient":
        return error("validation_error", "X-Device-ID header required", status=400)

    db.session.commit()
    return success(None)


@notifications_bp.get("/me")
@require_auth
def notifications_me():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    if not p.user_id:
        return success([])

    unread_only = str(request.args.get("unread_only", "")).lower() in ("1", "true", "yes")
    try:
        limit = min(100, max(1, int(request.args.get("limit", "50"))))
    except (TypeError, ValueError):
        limit = 50

    q = Notification.query.filter_by(recipient_user_id=p.user_id).order_by(Notification.sent_at.desc())
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    rows = q.limit(limit).all()
    return success([_serialize_notification(n) for n in rows])


@notifications_bp.put("/<notif_id>/read")
@require_auth
def notifications_mark_read(notif_id: str):
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    if not p.user_id:
        return error("validation_error", "No user linked", status=400)
    n = Notification.query.get(notif_id)
    if not n or n.recipient_user_id != p.user_id:
        return error("not_found", "Notification not found", status=404)
    n.read_at = datetime.now(timezone.utc)
    db.session.commit()
    return success(None)


@notifications_bp.get("/preferences")
@require_auth
def notification_preferences_get():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    if not p.user_id:
        return success(
            {
                "session_reminder_days_before": "[1]",
                "session_reminder_time": "09:00",
                "overdue_reminder_enabled": True,
                "overdue_reminder_after_days": 2,
                "alert_sms_enabled": True,
                "alert_push_enabled": True,
                "prescription_notifications_enabled": True,
                "marketing_enabled": False,
                "language": "en",
            }
        )
    pref = NotificationPreference.query.filter_by(user_id=p.user_id).first()
    if not pref:
        return success(
            {
                "session_reminder_days_before": "[1]",
                "session_reminder_time": "09:00",
                "overdue_reminder_enabled": True,
                "overdue_reminder_after_days": 2,
                "alert_sms_enabled": True,
                "alert_push_enabled": True,
                "prescription_notifications_enabled": True,
                "marketing_enabled": False,
                "language": "en",
            }
        )
    return success(_serialize_preferences(pref))


@notifications_bp.put("/preferences")
@require_auth
def notification_preferences_put():
    err = _require_patient()
    if err:
        return err
    p: Patient = g.current_user
    data = request.get_json(silent=True) or {}
    if not p.user_id:
        return error("validation_error", "Patient has no linked user row; cannot persist preferences", status=400)

    pref = NotificationPreference.query.filter_by(user_id=p.user_id).first()
    if not pref:
        pref = NotificationPreference(
            id=str(uuid.uuid4()),
            user_id=p.user_id,
            session_reminder_days_before="[1]",
            session_reminder_time="09:00",
            overdue_reminder_enabled=True,
            overdue_reminder_after_days=2,
            alert_sms_enabled=True,
            alert_push_enabled=True,
            prescription_notifications_enabled=True,
            marketing_enabled=False,
            language="en",
        )
        db.session.add(pref)

    if "session_reminder_days_before" in data:
        raw = data["session_reminder_days_before"]
        if isinstance(raw, list):
            pref.session_reminder_days_before = json.dumps([int(x) for x in raw if str(x).isdigit()])
        else:
            s = sanitise_string(str(raw)) or "[1]"
            try:
                parsed = json.loads(s)
                if not isinstance(parsed, list):
                    raise ValueError("not a list")
            except (json.JSONDecodeError, ValueError):
                return error("validation_error", "session_reminder_days_before must be a JSON array", status=400)
            pref.session_reminder_days_before = s[:200]
    if "session_reminder_time" in data:
        pref.session_reminder_time = sanitise_string(str(data["session_reminder_time"]))[:8] or "09:00"
    if "overdue_reminder_enabled" in data:
        pref.overdue_reminder_enabled = bool(data["overdue_reminder_enabled"])
    if "overdue_reminder_after_days" in data:
        try:
            pref.overdue_reminder_after_days = max(0, min(14, int(data["overdue_reminder_after_days"])))
        except (TypeError, ValueError):
            pass
    if "alert_sms_enabled" in data:
        pref.alert_sms_enabled = bool(data["alert_sms_enabled"])
    if "alert_push_enabled" in data:
        pref.alert_push_enabled = bool(data["alert_push_enabled"])
    if "prescription_notifications_enabled" in data:
        pref.prescription_notifications_enabled = bool(data["prescription_notifications_enabled"])
    if "marketing_enabled" in data:
        pref.marketing_enabled = bool(data["marketing_enabled"])
    if "language" in data:
        ln = str(data["language"]).lower()[:5]
        pref.language = "bn" if ln == "bn" else "en"

    if p.user_id:
        u = User.query.get(p.user_id)
        if u and "language" in data:
            ln = str(data["language"]).lower()[:5]
            u.preferred_language = "bn" if ln == "bn" else "en"

    db.session.commit()
    return success(None)
