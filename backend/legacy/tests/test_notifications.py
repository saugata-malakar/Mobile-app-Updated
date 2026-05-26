import json
from datetime import datetime
from zoneinfo import ZoneInfo

from models import Notification, Patient, SessionSchedule, User, db


def _post(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json", "X-Device-ID": "pytest-notif"}
    if headers:
        hdrs.update(headers)
    return client.post(path, data=json.dumps(data), headers=hdrs)


def _get(client, path, headers=None):
    hdrs = {"X-Device-ID": "pytest-notif"}
    if headers:
        hdrs.update(headers)
    return client.get(path, headers=hdrs)


def _put(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json", "X-Device-ID": "pytest-notif"}
    if headers:
        hdrs.update(headers)
    return client.put(path, data=json.dumps(data), headers=hdrs)


def _register_patient_with_user(client, phone="9555555501"):
    res = _post(
        client,
        "/api/v1/auth/register",
        {
            "full_name": "Notif Patient",
            "phone_number": phone,
            "age": 40,
            "gender": "male",
            "village": "NV",
            "password": "secret12",
            "date_of_birth": "1985-01-15",
        },
    )
    assert res.status_code == 201, res.get_json()
    return res.get_json()["data"]["token"], res.get_json()["data"]["user_id"]


def test_device_token_stores_on_user(client, app):
    token, user_id = _register_patient_with_user(client)
    auth = {"Authorization": f"Bearer {token}"}
    res = _post(client, "/api/v1/notifications/device-token", {"fcm_token": "fcm-xyz-999"}, headers=auth)
    assert res.status_code == 200, res.get_json()
    with app.app_context():
        u = User.query.get(user_id)
        assert u.fcm_token == "fcm-xyz-999"


def test_notifications_me_and_read(client, app):
    token, user_id = _register_patient_with_user(client, phone="9555555502")
    auth = {"Authorization": f"Bearer {token}"}
    with app.app_context():
        p = Patient.query.filter_by(phone="9555555502").first()
        n = Notification(
            recipient_user_id=user_id,
            notification_type="SYSTEM_MESSAGE",
            title_en="Hello",
            body_en="Body",
            channel="PUSH",
        )
        db.session.add(n)
        db.session.commit()
        nid = n.id

    res = _get(client, "/api/v1/notifications/me", headers=auth)
    assert res.status_code == 200
    items = res.get_json()["data"]
    assert any(x["id"] == nid for x in items)

    res = _put(client, f"/api/v1/notifications/{nid}/read", {}, headers=auth)
    assert res.status_code == 200
    with app.app_context():
        row = Notification.query.get(nid)
        assert row.read_at is not None


def test_preferences_put_get(client, app):
    token, user_id = _register_patient_with_user(client, phone="9555555503")
    auth = {"Authorization": f"Bearer {token}"}
    body = {
        "session_reminder_days_before": [1, 3],
        "session_reminder_time": "08:30",
        "overdue_reminder_enabled": False,
        "alert_sms_enabled": True,
        "alert_push_enabled": False,
        "prescription_notifications_enabled": False,
        "marketing_enabled": False,
        "language": "bn",
    }
    res = _put(client, "/api/v1/notifications/preferences", body, headers=auth)
    assert res.status_code == 200, res.get_json()
    res = _get(client, "/api/v1/notifications/preferences", headers=auth)
    d = res.get_json()["data"]
    assert d["language"] == "bn"
    assert d["overdue_reminder_enabled"] is False
    assert d["alert_push_enabled"] is False


def test_session_reminder_job_dry_run(client, app):
    _token, _user_id = _register_patient_with_user(client, phone="9555555504")
    with app.app_context():
        from datetime import timedelta

        p = Patient.query.filter_by(phone="9555555504").first()
        today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
        row = SessionSchedule(
            patient_id=p.id,
            session_type="WOUND_MONITORING",
            scheduled_date=today.isoformat(),
            due_by_date=(today + timedelta(days=2)).isoformat(),
            status="UPCOMING",
        )
        db.session.add(row)
        db.session.commit()

    from utils.session_reminder_job import run_session_reminders

    with app.app_context():
        stats = run_session_reminders()
        assert stats["due_today"] >= 1
