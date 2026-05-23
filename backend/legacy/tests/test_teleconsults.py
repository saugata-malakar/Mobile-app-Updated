import json
import uuid
from datetime import datetime, timedelta, timezone

from models import MonitoringSession, Patient, TeleconsultRequest, db
from utils.jwt_helper import make_tokens


def _post(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json", "X-Device-ID": "pytest-tele-t"}
    if headers:
        hdrs.update(headers)
    return client.post(path, data=json.dumps(data), headers=hdrs)


def _get(client, path, headers=None):
    hdrs = {"X-Device-ID": "pytest-tele-t"}
    if headers:
        hdrs.update(headers)
    return client.get(path, headers=hdrs)


def _put(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json", "X-Device-ID": "pytest-tele-t"}
    if headers:
        hdrs.update(headers)
    return client.put(path, data=json.dumps(data), headers=hdrs)


def _patient_auth(app, patient_id: str) -> dict:
    with app.app_context():
        token = make_tokens(patient_id, "patient")[0]
    return {"Authorization": f"Bearer {token}"}


def _shift_scheduled(app, tc_id: str, delta: timedelta):
    with app.app_context():
        tc = TeleconsultRequest.query.get(tc_id)
        now = datetime.now(timezone.utc)
        tc.scheduled_at = now + delta
        tc.estimated_callback_at = tc.scheduled_at
        db.session.commit()


def test_post_get_list_rate_flow(client, app, sample_patient, sample_doctor):
    from models import Doctor

    with app.app_context():
        d = Doctor.query.get(sample_doctor)
        d.consultation_phone = "+919911223344"
        db.session.commit()

    auth = _patient_auth(app, sample_patient)
    pref = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
    res = _post(
        client,
        "/api/v1/teleconsults",
        {
            "request_type": "ROUTINE",
            "patient_concern_en": "Foot wound pain",
            "patient_concern_bn": "",
            "preferred_callback_time": pref,
            "session_id": None,
            "alert_id": None,
        },
        headers=auth,
    )
    assert res.status_code == 201, res.get_json()
    body = res.get_json()["data"]
    tc_id = body["teleconsult_id"]
    assert body["estimated_callback_time"]

    res = _get(client, "/api/v1/teleconsults/me", headers=auth)
    assert res.status_code == 200
    lst = res.get_json()["data"]
    assert isinstance(lst, list)
    assert any(x["id"] == tc_id for x in lst)

    _shift_scheduled(app, tc_id, timedelta(hours=-3))

    res = client.post(
        f"/api/v1/teleconsults/{tc_id}/mark-received",
        headers={"Content-Type": "application/json", "Authorization": auth["Authorization"], "X-Device-ID": "t"},
    )
    assert res.status_code == 200, res.get_json()

    with app.app_context():
        tc = TeleconsultRequest.query.get(tc_id)
        tc.prescription_json = json.dumps(
            {
                "diagnosis": "DFU infection risk",
                "medications": [{"name": "Amoxicillin", "dose": "500mg", "frequency": "TDS", "duration": "7d"}],
                "wound_care_instructions_en": "Clean daily with sterile saline.",
                "wound_care_instructions_bn": "",
                "dressing_instructions": "Non-adherent pad; change every 24h.",
                "referral_required": False,
                "referral_details": "",
                "valid_until": "2026-12-31",
            }
        )
        db.session.commit()

    res = _get(client, f"/api/v1/teleconsults/{tc_id}", headers=auth)
    assert res.status_code == 200
    detail = res.get_json()["data"]
    assert detail["prescription"]["diagnosis"] == "DFU infection risk"

    res = _put(
        client,
        f"/api/v1/teleconsults/{tc_id}/rate",
        {"rating": 5, "feedback": "Very helpful"},
        headers=auth,
    )
    assert res.status_code == 200

    res = _get(client, f"/api/v1/teleconsults/{tc_id}", headers=auth)
    assert res.get_json()["data"]["patient_rating"] == 5


def test_invalid_session_for_other_patient(client, app, sample_patient):
    other = str(uuid.uuid4())
    with app.app_context():
        db.session.add(
            Patient(
                id=other,
                name="Other P",
                phone="9333333333",
                age=40,
                gender="Male",
                village="V",
            )
        )
        sid = str(uuid.uuid4())
        db.session.add(
            MonitoringSession(
                id=sid,
                patient_id=other,
                session_type="WOUND_MONITORING",
                track="COMMERCIAL",
                status="SUBMITTED",
            )
        )
        db.session.commit()

    auth = _patient_auth(app, sample_patient)
    res = _post(
        client,
        "/api/v1/teleconsults",
        {
            "request_type": "URGENT",
            "patient_concern_en": "x",
            "preferred_callback_time": datetime.now(timezone.utc).isoformat(),
            "session_id": sid,
        },
        headers=auth,
    )
    assert res.status_code == 400


def test_cancel_window(client, app, sample_patient, sample_doctor):
    from models import Doctor

    with app.app_context():
        d = Doctor.query.get(sample_doctor)
        d.consultation_phone = "+919900000001"
        db.session.commit()

    auth = _patient_auth(app, sample_patient)
    pref = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
    res = _post(
        client,
        "/api/v1/teleconsults",
        {"request_type": "FOLLOW_UP", "patient_concern_en": "ok", "preferred_callback_time": pref},
        headers=auth,
    )
    tc_id = res.get_json()["data"]["teleconsult_id"]
    res = client.post(
        f"/api/v1/teleconsults/{tc_id}/cancel",
        headers={"Content-Type": "application/json", "Authorization": auth["Authorization"], "X-Device-ID": "t"},
    )
    assert res.status_code == 200
