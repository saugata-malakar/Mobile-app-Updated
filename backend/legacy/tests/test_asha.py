import json

from models import Screening, db


def _asha_token(client, worker_id="asha_test", pin="1234"):
    res = client.post(
        "/api/v1/auth/asha/login",
        data=json.dumps({"worker_id": worker_id, "pin": pin}),
        headers={"Content-Type": "application/json"},
    )
    return res.get_json()["data"]["token"]


def _patient_token(client, phone="9111111111"):
    res = client.post(
        "/api/v1/auth/patient/login",
        data=json.dumps({"phone": phone}),
        headers={"Content-Type": "application/json"},
    )
    return res.get_json()["data"]["token"]


def test_asha_dashboard_returns_stats(client, app, sample_asha, sample_patient):
    from datetime import datetime, timezone

    with app.app_context():
        s = Screening(
            patient_id=sample_patient,
            asha_id=sample_asha,
            condition_type="skin",
            risk_level="low",
            consent_timestamp=datetime.now(timezone.utc),
        )
        db.session.add(s)
        db.session.commit()

    token = _asha_token(client)
    res = client.get(
        "/api/v1/asha/me/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.get_json()["data"]
    assert body["screenings_today"] >= 1


def test_patient_cannot_access_asha_routes(client, sample_patient):
    token = _patient_token(client)
    res = client.get(
        "/api/v1/asha/me/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_asha_screenings_list(client, app, sample_asha, sample_patient):
    from datetime import datetime, timezone

    with app.app_context():
        s = Screening(
            patient_id=sample_patient,
            asha_id=sample_asha,
            condition_type="eye",
            risk_level="medium",
            consent_timestamp=datetime.now(timezone.utc),
        )
        db.session.add(s)
        db.session.commit()

    token = _asha_token(client)
    res = client.get(
        "/api/v1/asha/me/screenings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200


def test_asha_commission_list(client, sample_asha):
    token = _asha_token(client)
    res = client.get(
        "/api/v1/asha/me/commissions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "total_paid" in res.get_json()["data"]
