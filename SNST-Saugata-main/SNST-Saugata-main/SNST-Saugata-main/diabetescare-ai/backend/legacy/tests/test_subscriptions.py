"""Phase D1: subscription state machine and API."""
import json

import pytest

from models import Patient, PaymentTransaction, Subscription, SubscriptionTier, db
from subscription_service import (
    apply_payment_failed,
    apply_payment_success,
    ensure_trial_subscription,
    get_patient_subscription,
    patient_has_module_access,
    transition,
)


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
            "name": "Sub Patient",
            "phone": "9666666666",
            "age": 40,
            "gender": "Male",
            "village": "SubV",
        },
    )
    assert res.status_code == 201
    return res.get_json()["data"]["token"]


def test_state_transitions_unit(app):
    with app.app_context():
        tier = SubscriptionTier.query.filter_by(tier_name="BASIC").first()
        p = Patient(
            name="SM",
            phone="9666666601",
            age=30,
            gender="Male",
            village="V",
        )
        db.session.add(p)
        db.session.flush()
        sub = ensure_trial_subscription(p.id)
        assert sub.status == "TRIAL"
        transition(sub, "payment_success")
        assert sub.status == "ACTIVE"
        transition(sub, "payment_failed")
        assert sub.status == "PAYMENT_FAILED"
        transition(sub, "enter_grace")
        assert sub.status == "GRACE_PERIOD"
        transition(sub, "grace_expire")
        assert sub.status == "SUSPENDED"
        allowed, _ = patient_has_module_access(sub)
        assert allowed is False


def test_full_subscription_payment_flow(client, app):
    token = _patient_token(client)
    auth = {"Authorization": f"Bearer {token}"}

    res = _get(client, "/api/v1/subscriptions/tiers")
    assert res.status_code == 200
    tiers = res.get_json()["data"]["tiers"]
    assert len(tiers) >= 3
    basic = next(t for t in tiers if t["tier_name"] == "BASIC")

    res = _post(client, "/api/v1/subscriptions", {"tier_id": basic["id"]}, headers=auth)
    assert res.status_code == 201
    body = res.get_json()["data"]
    order_id = body["razorpay_order"]["id"]

    res = _post(
        client,
        "/api/v1/payments/verify",
        {
            "razorpay_payment_id": "pay_success_test",
            "razorpay_order_id": order_id,
            "razorpay_signature": "mock_sig_ok",
        },
        headers=auth,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["subscription_active"] is True

    res = _get(client, "/api/v1/subscriptions/me", headers=auth)
    assert res.get_json()["data"]["subscription"]["status"] == "ACTIVE"


def test_payment_failed_status(client, app):
    token = _patient_token(client)
    auth = {"Authorization": f"Bearer {token}"}

    tiers = _get(client, "/api/v1/subscriptions/tiers", headers=auth).get_json()["data"]["tiers"]
    basic = next(t for t in tiers if t["tier_name"] == "BASIC")
    res = _post(client, "/api/v1/subscriptions", {"tier_id": basic["id"]}, headers=auth)
    order_id = res.get_json()["data"]["razorpay_order"]["id"]
    res = _post(
        client,
        "/api/v1/payments/verify",
        {
            "razorpay_payment_id": "pay_success_test",
            "razorpay_order_id": order_id,
            "razorpay_signature": "mock_sig_ok",
        },
        headers=auth,
    )
    assert res.status_code == 200

    res = _post(client, "/api/v1/subscriptions", {"tier_name": "STANDARD"}, headers=auth)
    order_id = res.get_json()["data"]["razorpay_order"]["id"]

    res = _post(
        client,
        "/api/v1/payments/verify",
        {
            "razorpay_payment_id": "pay_failed_test",
            "razorpay_order_id": order_id,
            "razorpay_signature": "mock_sig_fail",
        },
        headers=auth,
    )
    assert res.status_code == 402

    with app.app_context():
        p = Patient.query.filter_by(phone="9666666666").first()
        sub = get_patient_subscription(p.id)
        assert sub.status in ("PAYMENT_FAILED", "GRACE_PERIOD")


def test_session_submit_blocked_when_suspended(client, app):
    token = _patient_token(client)
    auth = {"Authorization": f"Bearer {token}"}

    with app.app_context():
        p = Patient.query.filter_by(phone="9666666666").first()
        sub = get_patient_subscription(p.id)
        sub.status = "SUSPENDED"
        db.session.commit()

    res = _post(
        client,
        "/api/v1/sessions",
        {"session_type": "WOUND_MONITOR", "track": "WOUND"},
        headers=auth,
    )
    assert res.status_code == 201
    sid = res.get_json()["data"]["session"]["id"]
    res = _post(
        client,
        f"/api/v1/sessions/{sid}/photographs",
        {"angle": "TOP", "quality_score": 0.9},
        headers=auth,
    )
    assert res.status_code == 201
    res = _post(client, f"/api/v1/sessions/{sid}/submit", {}, headers=auth)
    assert res.status_code == 403
    assert res.get_json()["error"]["code"] == "subscription_inactive"
