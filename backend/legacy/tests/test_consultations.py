import json
from datetime import datetime, timezone

from models import Consultation, Screening, db


def _auth_headers(token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


def _login_patient(client, phone="9111111111"):
    res = client.post(
        "/api/v1/auth/patient/login",
        data=json.dumps({"phone": phone}),
        headers={"Content-Type": "application/json"},
    )
    return res.get_json()["data"]["token"]


def _make_screening(app, patient_id):
    with app.app_context():
        s = Screening(
            patient_id=patient_id,
            condition_type="skin",
            risk_level="medium",
            consent_timestamp=datetime.now(timezone.utc),
        )
        db.session.add(s)
        db.session.commit()
        return s.id


def test_create_consultation_async(client, app, sample_patient):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    res = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid, "mode": "async"}),
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_create_consultation_scheduled_no_slot(client, app, sample_patient):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    res = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid, "mode": "scheduled"}),
        headers=_auth_headers(token),
    )
    assert res.status_code == 400


def test_create_consultation_scheduled_with_slot(client, app, sample_patient):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    res = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid, "mode": "scheduled", "time_slot": "MORNING"}),
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_create_consultation_instant(client, app, sample_patient, sample_doctor):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    res = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid, "mode": "instant"}),
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_get_consultation_status(client, app, sample_patient):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    cres = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid, "mode": "async"}),
        headers=_auth_headers(token),
    )
    cid = cres.get_json()["data"]["consultation_id"]
    res = client.get(f"/api/v1/consultations/{cid}/status", headers=_auth_headers(token))
    assert res.status_code == 200


def test_queue_position_is_1_when_empty(client, app, sample_patient, sample_doctor):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    res = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid, "mode": "async"}),
        headers=_auth_headers(token),
    )
    assert res.get_json()["data"]["queue_position"] == 1


def test_queue_position_increments(client, app, sample_patient):
    token = _login_patient(client)
    sid1 = _make_screening(app, sample_patient)
    sid2 = _make_screening(app, sample_patient)
    client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid1, "mode": "async"}),
        headers=_auth_headers(token),
    )
    res2 = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid2, "mode": "async"}),
        headers=_auth_headers(token),
    )
    assert res2.get_json()["data"]["queue_position"] == 2


def test_cancel_pending_consultation(client, app, sample_patient):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    cres = client.post(
        "/api/v1/consultations",
        data=json.dumps({"screening_id": sid, "mode": "async"}),
        headers=_auth_headers(token),
    )
    cid = cres.get_json()["data"]["consultation_id"]
    res = client.put(
        f"/api/v1/consultations/{cid}/cancel",
        data=json.dumps({}),
        headers=_auth_headers(token),
    )
    assert res.status_code == 200


def test_cancel_completed_consultation(client, app, sample_patient, sample_doctor):
    token = _login_patient(client)
    sid = _make_screening(app, sample_patient)
    with app.app_context():
        c = Consultation(
            screening_id=sid,
            patient_id=sample_patient,
            doctor_id=sample_doctor,
            mode="async",
            status="completed",
            completed_at=datetime.now(timezone.utc),
        )
        db.session.add(c)
        db.session.commit()
        cid = c.id

    res = client.put(
        f"/api/v1/consultations/{cid}/cancel",
        data=json.dumps({}),
        headers=_auth_headers(token),
    )
    assert res.status_code == 400
