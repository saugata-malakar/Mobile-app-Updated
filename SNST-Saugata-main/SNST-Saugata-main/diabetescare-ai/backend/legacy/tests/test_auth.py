import json

from models import AshaWorker, Patient, db


def _post(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    return client.post(path, data=json.dumps(data), headers=hdrs)


def test_patient_register_success(client, app):
    res = _post(
        client,
        "/api/v1/auth/patient/register",
        {
            "name": "Dipak",
            "phone": "9333333333",
            "age": 51,
            "gender": "Male",
            "village": "IIT KGP",
        },
    )
    assert res.status_code == 201
    body = res.get_json()
    assert body["success"] is True
    assert "token" in body["data"]
    assert body["data"]["patient"]["phone"] == "9333333333"


def test_patient_register_duplicate_phone(client, app):
    with app.app_context():
        db.session.add(
            Patient(
                name="X",
                phone="9444444444",
                age=20,
                gender="Female",
                village="V",
            )
        )
        db.session.commit()

    res = _post(
        client,
        "/api/v1/auth/patient/register",
        {
            "name": "Y",
            "phone": "9444444444",
            "age": 22,
            "gender": "Male",
            "village": "V2",
        },
    )
    assert res.status_code == 409


def test_patient_register_missing_name(client):
    res = _post(
        client,
        "/api/v1/auth/patient/register",
        {"phone": "9555555555", "age": 20, "gender": "Male", "village": "V"},
    )
    assert res.status_code == 400


def test_patient_register_invalid_phone(client):
    res = _post(
        client,
        "/api/v1/auth/patient/register",
        {
            "name": "A",
            "phone": "123",
            "age": 20,
            "gender": "Male",
            "village": "V",
        },
    )
    assert res.status_code == 400


def test_patient_register_invalid_age(client):
    res = _post(
        client,
        "/api/v1/auth/patient/register",
        {
            "name": "A",
            "phone": "9666666666",
            "age": 200,
            "gender": "Male",
            "village": "V",
        },
    )
    assert res.status_code == 400


def test_patient_login_success(client, app, sample_patient):
    res = _post(client, "/api/v1/auth/patient/login", {"phone": "9111111111"})
    assert res.status_code == 200
    assert res.get_json()["success"] is True


def test_patient_login_not_found(client):
    res = _post(client, "/api/v1/auth/patient/login", {"phone": "9000000001"})
    assert res.status_code == 404


def test_asha_login_success(client, sample_asha):
    res = _post(
        client,
        "/api/v1/auth/asha/login",
        {"worker_id": "asha_test", "pin": "1234"},
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["asha"]["worker_id"] == "asha_test"


def test_asha_login_wrong_pin(client, sample_asha):
    res = _post(
        client,
        "/api/v1/auth/asha/login",
        {"worker_id": "asha_test", "pin": "9999"},
    )
    assert res.status_code == 401


def test_asha_login_inactive(client, app, sample_asha):
    with app.app_context():
        w = AshaWorker.query.get(sample_asha)
        w.active = False
        db.session.commit()

    res = _post(
        client,
        "/api/v1/auth/asha/login",
        {"worker_id": "asha_test", "pin": "1234"},
    )
    assert res.status_code == 403


def test_token_required_without_header(client):
    res = client.get("/api/v1/patients/me")
    assert res.status_code == 401


def test_refresh_token(client, app, sample_patient):
    login = _post(client, "/api/v1/auth/patient/login", {"phone": "9111111111"})
    refresh = login.get_json()["data"]["refresh_token"]
    assert refresh
    res = client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {refresh}", "Content-Type": "application/json"},
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "token" in data
    assert "refresh_token" in data


def test_spec_register_and_medical_history(client, app):
    res = _post(
        client,
        "/api/v1/auth/register",
        {
            "phone_number": "9888888888",
            "password": "secret12",
            "full_name": "Test User",
            "date_of_birth": "1990-01-15",
            "gender": "male",
            "village": "TestVillage",
            "role": "patient",
        },
    )
    assert res.status_code == 201
    body = res.get_json()
    assert body["success"] is True
    token = body["data"]["token"]

    mh = _post(
        client,
        "/api/v1/patients/me/medical-history",
        {"diabetes_type": "TYPE2", "has_hypertension": True, "notes": "ok"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert mh.status_code == 201
    assert mh.get_json()["data"]["version_number"] == 1

    cg = _post(
        client,
        "/api/v1/patients/me/consent",
        {
            "consent_version": "1.0",
            "consent_type": "STAGE1_RESEARCH",
            "signed_by_method": "DIGITAL_SIGNATURE",
            "modules_consented": ["WOUND"],
            "digital_signature_hash": "sha256:abc",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cg.status_code == 201

    lst = client.get(
        "/api/v1/patients/me/consents",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert lst.status_code == 200
    assert len(lst.get_json()["data"]) >= 1
