"""Subscription tiers and patient subscription lifecycle (Phase D1 / Section 5.9)."""
from __future__ import annotations

import os

from flask import Blueprint, g, request

from middleware.auth_middleware import require_auth
from models import PaymentTransaction, Subscription, SubscriptionTier, db
from subscription_service import (
    apply_cancel,
    apply_pause,
    create_or_prepare_subscription,
    get_patient_subscription,
    patient_has_module_access,
    subscription_to_dict,
    tier_by_id,
    tier_by_name,
    tier_to_dict,
    transition,
)
from utils.razorpay_client import create_order
from utils.response_helper import error, success

subscriptions_bp = Blueprint("subscriptions", __name__)


def _require_patient():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Patient access only", status=403)
    return None


@subscriptions_bp.get("/tiers")
def list_tiers():
    tiers = SubscriptionTier.query.filter_by(is_active=True).order_by(SubscriptionTier.price_monthly_rs).all()
    return success({"tiers": [tier_to_dict(t) for t in tiers]})


@subscriptions_bp.get("/me")
@require_auth
def my_subscription():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    sub = get_patient_subscription(p.id)
    if not sub:
        return success({"subscription": None, "module_access_allowed": False})
    allowed, reason = patient_has_module_access(sub)
    data = subscription_to_dict(sub)
    data["access_reason"] = reason if not allowed else None
    return success({"subscription": data, "module_access_allowed": allowed})


@subscriptions_bp.post("")
@require_auth
def create_subscription():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    data = request.get_json(silent=True) or {}
    tier_id = data.get("tier_id")
    tier_name = data.get("tier_name") or data.get("tier")

    tier = None
    if tier_id:
        tier = tier_by_id(str(tier_id))
    elif tier_name:
        tier = tier_by_name(str(tier_name))
    if not tier:
        return error("validation_error", "tier_id or tier_name required", status=400)

    sub, txn = create_or_prepare_subscription(p.id, tier)
    order = create_order(
        float(tier.price_monthly_rs),
        receipt=txn.id[:40],
        notes={"patient_id": p.id, "subscription_id": sub.id, "txn_id": txn.id},
    )
    txn.razorpay_order_id = order.get("id")
    db.session.commit()

    return success(
        {
            "subscription_id": sub.id,
            "subscription": subscription_to_dict(sub),
            "razorpay_order": order,
            "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID", "rzp_test_mock"),
        },
        status=201,
    )


@subscriptions_bp.post("/me/upgrade")
@require_auth
def upgrade_subscription():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    data = request.get_json(silent=True) or {}
    new_tier_id = data.get("new_tier_id") or data.get("tier_id")
    tier = tier_by_id(str(new_tier_id)) if new_tier_id else None
    if not tier:
        return error("validation_error", "new_tier_id required", status=400)

    sub = get_patient_subscription(p.id)
    if not sub:
        return error("not_found", "No subscription to upgrade", status=404)

    sub.tier_id = tier.id
    sub.amount_rs = float(tier.price_monthly_rs)
    import uuid

    txn = PaymentTransaction(
        id=str(uuid.uuid4()),
        subscription_id=sub.id,
        patient_id=p.id,
        transaction_type="SUBSCRIPTION_UPGRADE",
        amount_rs=float(tier.price_monthly_rs),
        currency="INR",
        status="INITIATED",
    )
    db.session.add(txn)
    db.session.flush()

    order = create_order(float(tier.price_monthly_rs), receipt=txn.id[:40])
    txn.razorpay_order_id = order.get("id")
    db.session.commit()

    return success(
        {
            "razorpay_order": order,
            "subscription": subscription_to_dict(sub),
            "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID", "rzp_test_mock"),
        }
    )


@subscriptions_bp.post("/me/pause")
@require_auth
def pause_subscription():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    data = request.get_json(silent=True) or {}
    pause_days = int(data.get("pause_days", 7))
    sub = get_patient_subscription(p.id)
    if not sub:
        return error("not_found", "No subscription", status=404)
    try:
        apply_pause(sub, pause_days)
    except ValueError as e:
        return error("validation_error", str(e), status=400)
    db.session.commit()
    return success(
        {
            "pause_ends_at": sub.pause_ends_at.isoformat() if sub.pause_ends_at else None,
            "subscription": subscription_to_dict(sub),
        }
    )


@subscriptions_bp.post("/me/cancel")
@require_auth
def cancel_subscription():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()
    sub = get_patient_subscription(p.id)
    if not sub:
        return error("not_found", "No subscription", status=404)
    try:
        apply_cancel(sub, reason)
    except ValueError as e:
        return error("validation_error", str(e), status=400)
    db.session.commit()
    return success(
        {
            "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
            "subscription": subscription_to_dict(sub),
        }
    )
