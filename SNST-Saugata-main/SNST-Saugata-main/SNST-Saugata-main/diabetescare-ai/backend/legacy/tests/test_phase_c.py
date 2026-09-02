import json
import uuid
from datetime import datetime, timedelta, timezone

from models import Alert, db


def _post(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json", "X-Device-ID": "pytest-device-c"}
    if headers:
        hdrs.update(headers)
    return client.post(path, data=json.dumps(data), headers=hdrs)


def _get(client, path, headers=None):
    hdrs = {"X-Device-ID": "pytest-device-c"}
    if headers:
        hdrs.update(headers)
    return client.get(path, headers=hdrs)


def _patient_token(client, phone="9444444442"):
    res = _post(
        client,
        "/api/v1/auth/register",
        {
            "full_name": "Phase C Patient",
            "phone_number": phone,
            "gender": "male",
            "village": "PCV",
            "password": "secret12",
            "date_of_birth": "1980-06-01",
        },
    )
    assert res.status_code == 201
    return res.get_json()["data"]["token"]


def test_eye_triage_stub_non_urgent_no_alert(client, app):
    token = _patient_token(client)
    auth = {"Authorization": f"Bearer {token}"}

    res = _post(
        client,
        "/api/v1/sessions",
        {"session_type": "EYE_TRIAGE", "track": "CONTRIBUTING"},
        headers=auth,
    )
    sid = res.get_json()["data"]["session"]["id"]
    res = _post(
        client,
        f"/api/v1/sessions/{sid}/photographs",
        {"angle": "ANTERIOR"},
        headers=auth,
    )
    assert res.status_code == 201
    res = _post(client, f"/api/v1/sessions/{sid}/submit", {}, headers=auth)
    assert res.status_code == 200
    assert res.get_json()["data"].get("alert_id") is None
    air = res.get_json()["data"]["ai_result"]
    assert air["eye_urgency"] == "NON_URGENT"
    assert air["eye_urgency_confidence"] == 0.91

    res = _post(
        client,
        "/api/v1/notifications/device-token",
        {"token": "fcm-test-token-123"},
        headers=auth,
    )
    assert res.status_code == 200


def _put(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json", "X-Device-ID": "pytest-device-c"}
    if headers:
        hdrs.update(headers)
    return client.put(path, data=json.dumps(data), headers=hdrs)


def test_put_alerts_acknowledge_with_note(client, app):
    token = _patient_token(client, phone="9444444455")
    auth = {"Authorization": f"Bearer {token}"}
    res = _post(
        client,
        "/api/v1/sessions",
        {"session_type": "PALLOR_TRIAGE", "track": "CONTRIBUTING"},
        headers=auth,
    )
    sid = res.get_json()["data"]["session"]["id"]
    _post(client, f"/api/v1/sessions/{sid}/photographs", {"angle": "CONJUNCTIVA"}, headers=auth)
    res = _post(client, f"/api/v1/sessions/{sid}/submit", {}, headers=auth)
    aid = res.get_json()["data"]["alert_id"]
    res = _put(
        client,
        f"/api/v1/alerts/{aid}/acknowledge",
        {"note": "Seen and resting"},
        headers=auth,
    )
    assert res.status_code == 200
    res = _get(client, f"/api/v1/patients/me/alerts?resolved=true&limit=1", headers=auth)
    row = res.get_json()["data"]["items"][0]
    assert row["id"] == aid
    assert row.get("acknowledgement_note")


def test_skin_schedules_seeded_with_wound_site(client, app):
    token = _patient_token(client)
    auth = {"Authorization": f"Bearer {token}"}
    res = _post(
        client,
        "/api/v1/patients/me/wound-sites",
        {
            "foot_side": "LEFT",
            "location_on_foot": "HEEL",
            "first_detected_date": "2026-02-01",
        },
        headers=auth,
    )
    assert res.status_code == 201
    res = _get(client, "/api/v1/patients/me/schedule", headers=auth)
    types = {r["session_type"] for r in res.get_json()["data"]["items"]}
    assert "SKIN_MONITOR" in types
    assert "CONTRIBUTING_QUARTERLY" in types
    n_cq = sum(1 for r in res.get_json()["data"]["items"] if r["session_type"] == "CONTRIBUTING_QUARTERLY")
    assert n_cq >= 4


def test_pallor_stub_payload(client, app):
    token = _patient_token(client, phone="9444444461")
    auth = {"Authorization": f"Bearer {token}"}
    res = _post(
        client,
        "/api/v1/sessions",
        {"session_type": "PALLOR_TRIAGE", "track": "CONTRIBUTING"},
        headers=auth,
    )
    sid = res.get_json()["data"]["session"]["id"]
    _post(client, f"/api/v1/sessions/{sid}/photographs", {"angle": "CONJUNCTIVA"}, headers=auth)
    res = _post(client, f"/api/v1/sessions/{sid}/submit", {}, headers=auth)
    assert res.status_code == 200
    air = res.get_json()["data"]["ai_result"]
    assert air["pallor_level"] == "MILD"
    assert air["pallor_confidence"] == 0.78
    assert air["pallor_wound_implication"] == "Mild anaemia may slow wound healing"
    assert res.get_json()["data"].get("alert_id")


def test_skin_monitor_four_photos_stub_payload_and_history(client, app):
    token = _patient_token(client, phone="9444444460")
    auth = {"Authorization": f"Bearer {token}"}
    res = _post(
        client,
        "/api/v1/sessions",
        {"session_type": "SKIN_MONITOR", "track": "SKIN"},
        headers=auth,
    )
    assert res.status_code == 201
    sid = res.get_json()["data"]["session"]["id"]
    res = _post(client, f"/api/v1/sessions/{sid}/submit", {}, headers=auth)
    assert res.status_code == 400
    for ang in ("WEB_SPACE", "SOLE", "PERIWOUND", "LOWER_LEG"):
        r = _post(client, f"/api/v1/sessions/{sid}/photographs", {"angle": ang}, headers=auth)
        assert r.status_code == 201
    res = _post(client, f"/api/v1/sessions/{sid}/submit", {}, headers=auth)
    assert res.status_code == 200
    air = res.get_json()["data"]["ai_result"]
    assert air["skin_condition_primary"] == "TINEA_PEDIS"
    assert air["skin_condition_confidence"] == 0.82
    assert air["skin_wound_risk_level"] == "MEDIUM"
    assert air["maceration_detected"] == 0
    assert air["prescription_required"] == 0
    assert air["treatment_recommendation"]["otc_medication_en"]
    assert res.get_json()["data"].get("alert_id")

    res = _get(client, "/api/v1/patients/me/monitoring-sessions?session_type=SKIN_MONITOR", headers=auth)
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert len(items) >= 1
    assert items[0]["session_id"] == sid


def test_admin_escalation_job(client, app, admin_user, sample_patient):
    with app.app_context():
        aid = str(uuid.uuid4())
        db.session.add(
            Alert(
                id=aid,
                patient_id=sample_patient,
                alert_level="RED",
                alert_type="TEST",
                message_patient_en="test escalation",
            )
        )
        row = Alert.query.get(aid)
        row.generated_at = datetime.now(timezone.utc) - timedelta(hours=6)
        db.session.commit()

    login = _post(
        client,
        "/api/v1/auth/admin/login",
        {"email": "admin_t@example.com", "password": "adminpass"},
    )
    assert login.status_code == 200
    adm_tok = login.get_json()["data"]["token"]
    res = _post(
        client,
        "/api/v1/admin/jobs/escalate-red-alerts",
        {},
        headers={"Authorization": f"Bearer {adm_tok}"},
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["stale_red_alerts_notified"] >= 1
