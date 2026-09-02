import json
from datetime import datetime, timezone

from models import AshaWorker, Commission, Patient, Screening, db


def _auth_headers(token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


def _login_patient(client, phone="9111111111"):
    res = client.post(
        "/api/v1/auth/patient/login",
        data=json.dumps({"phone": phone}),
        headers={"Content-Type": "application/json"},
    )
    return res.get_json()["data"]["token"]


def test_create_screening_as_patient(client, app, sample_patient):
    token = _login_patient(client)
    payload = {
        "condition_type": "skin",
        "risk_level": "low",
        "consent_timestamp": datetime.now(timezone.utc).isoformat(),
        "ai_result": {"note": "x"},
    }
    res = client.post(
        "/api/v1/screenings",
        data=json.dumps(payload),
        headers=_auth_headers(token),
    )
    assert res.status_code == 201
    assert res.get_json()["data"]["screening_id"]


def test_create_screening_no_auth(client):
    res = client.post(
        "/api/v1/screenings",
        data=json.dumps({}),
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 401


def test_create_screening_invalid_condition(client, sample_patient):
    token = _login_patient(client)
    payload = {
        "condition_type": "invalid",
        "risk_level": "low",
        "consent_timestamp": datetime.now(timezone.utc).isoformat(),
    }
    res = client.post(
        "/api/v1/screenings",
        data=json.dumps(payload),
        headers=_auth_headers(token),
    )
    assert res.status_code == 400


def test_create_screening_missing_consent(client, sample_patient):
    token = _login_patient(client)
    payload = {"condition_type": "skin", "risk_level": "low"}
    res = client.post(
        "/api/v1/screenings",
        data=json.dumps(payload),
        headers=_auth_headers(token),
    )
    assert res.status_code == 400


def test_create_screening_with_asha_id(client, app, sample_patient, sample_asha):
    token = _login_patient(client)
    payload = {
        "condition_type": "eye",
        "risk_level": "medium",
        "consent_timestamp": datetime.now(timezone.utc).isoformat(),
        "asha_id": sample_asha,
    }
    res = client.post(
        "/api/v1/screenings",
        data=json.dumps(payload),
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_get_own_screening(client, app, sample_patient):
    token = _login_patient(client)
    with app.app_context():
        s = Screening(
            patient_id=sample_patient,
            condition_type="skin",
            risk_level="low",
            consent_timestamp=datetime.now(timezone.utc),
        )
        db.session.add(s)
        db.session.commit()
        sid = s.id

    res = client.get(f"/api/v1/screenings/{sid}", headers=_auth_headers(token))
    assert res.status_code == 200


def test_get_other_patient_screening(client, app, sample_patient):
    with app.app_context():
        p2 = Patient(
            name="Other",
            phone="9777777777",
            age=40,
            gender="Male",
            village="V",
        )
        db.session.add(p2)
        db.session.flush()
        s = Screening(
            patient_id=p2.id,
            condition_type="skin",
            risk_level="low",
            consent_timestamp=datetime.now(timezone.utc),
        )
        db.session.add(s)
        db.session.commit()
        sid = s.id

    token = _login_patient(client)
    res = client.get(f"/api/v1/screenings/{sid}", headers=_auth_headers(token))
    assert res.status_code == 403


def test_asha_commission_created_on_screening(client, app, sample_patient, sample_asha):
    token = _login_patient(client)
    payload = {
        "condition_type": "wound",
        "risk_level": "high",
        "consent_timestamp": datetime.now(timezone.utc).isoformat(),
        "asha_id": sample_asha,
    }
    res = client.post(
        "/api/v1/screenings",
        data=json.dumps(payload),
        headers=_auth_headers(token),
    )
    assert res.status_code == 201
    screening_id = res.get_json()["data"]["screening_id"]
    with app.app_context():
        c = Commission.query.filter_by(screening_id=screening_id).first()
        assert c is not None
        assert c.amount == 15.0
