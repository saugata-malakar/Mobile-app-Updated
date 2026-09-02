import json

from models import AshaTrainingModule, Patient, db


def _post(client, path, data, headers=None):
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    return client.post(path, data=json.dumps(data), headers=hdrs)


def _get(client, path, headers=None):
    hdrs = {}
    if headers:
        hdrs.update(headers)
    return client.get(path, headers=hdrs)


def _patient_token(client):
    res = _post(
        client,
        "/api/v1/auth/patient/register",
        {
            "name": "Wound Patient",
            "phone": "9555555555",
            "age": 55,
            "gender": "Male",
            "village": "TestV",
        },
    )
    assert res.status_code == 201
    return res.get_json()["data"]["token"]


def test_wound_site_schedule_and_session_flow(client, app):
    token = _patient_token(client)
    auth = {"Authorization": f"Bearer {token}"}

    res = _post(
        client,
        "/api/v1/patients/me/wound-sites",
        {
            "foot_side": "RIGHT",
            "location_on_foot": "PLANTAR_FIRST_METATARSAL",
            "first_detected_date": "2026-01-01",
            "toe_number": None,
        },
        headers=auth,
    )
    assert res.status_code == 201
    wid = res.get_json()["data"]["wound_site"]["id"]

    res = _get(client, "/api/v1/patients/me/schedule", headers=auth)
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert len(items) >= 4

    res = _post(
        client,
        "/api/v1/sessions",
        {"wound_site_id": wid, "session_type": "WOUND_MONITOR", "track": "WOUND"},
        headers=auth,
    )
    assert res.status_code == 201
    sid = res.get_json()["data"]["session"]["id"]

    res = _post(
        client,
        f"/api/v1/sessions/{sid}/photographs",
        {"angle": "TOP", "quality_score": 0.81},
        headers=auth,
    )
    assert res.status_code == 201

    res = _post(client, f"/api/v1/sessions/{sid}/submit", {}, headers=auth)
    assert res.status_code == 200
    body = res.get_json()["data"]
    assert body["ai_result"]["wagner_grade"] == 1
    assert body["ai_result"]["alert_level"] == "YELLOW"

    res = _get(client, "/api/v1/patients/me/wound-history", headers=auth)
    assert res.status_code == 200
    hist = res.get_json()["data"]
    assert len(hist["items"]) >= 1


def test_asha_training_and_patient_search(client, app, sample_asha):
    with app.app_context():
        p = Patient(
            name="Search Me",
            phone="9666666666",
            age=40,
            gender="Female",
            village="V2",
            consent_given_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        )
        db.session.add(p)
        db.session.commit()

    login = _post(
        client,
        "/api/v1/auth/asha/login",
        {"worker_id": "asha_test", "pin": "1234"},
    )
    assert login.status_code == 200
    token = login.get_json()["data"]["token"]
    auth = {"Authorization": f"Bearer {token}"}

    res = _get(client, "/api/v1/asha/me/training", headers=auth)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["all_passed"] is False
    assert len(data["modules"]) == 2

    code = data["modules"][0]["module_code"]
    res = _post(
        client,
        "/api/v1/asha/me/training/complete",
        {"module_code": code, "score": 90},
        headers=auth,
    )
    assert res.status_code == 200

    res = _get(client, "/api/v1/asha/me/patients/search?q=966", headers=auth)
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert len(items) >= 1

    with app.app_context():
        row = AshaTrainingModule.query.filter_by(asha_id=sample_asha, module_code=code).first()
        assert row is not None
        assert row.passed is True


def test_asha_creates_patient_wound_site(client, app, sample_asha):
    with app.app_context():
        p = Patient(
            name="Wound Target",
            phone="9777777777",
            age=50,
            gender="Male",
            village="V2",
            consent_given_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        )
        db.session.add(p)
        db.session.commit()
        pid = p.id

    login = _post(
        client,
        "/api/v1/auth/asha/login",
        {"worker_id": "asha_test", "pin": "1234"},
    )
    token = login.get_json()["data"]["token"]
    auth = {"Authorization": f"Bearer {token}"}

    res = _post(
        client,
        f"/api/v1/asha/patients/{pid}/wound-sites",
        {
            "foot_side": "LEFT",
            "location_on_foot": "HEEL",
            "first_detected_date": "2026-05-01",
        },
        headers=auth,
    )
    assert res.status_code == 201
    wid = res.get_json()["data"]["wound_site"]["id"]
    assert wid
