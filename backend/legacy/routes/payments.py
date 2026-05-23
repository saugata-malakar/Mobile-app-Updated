"""Payment verification and history (Phase D1 / Section 5.9)."""
from __future__ import annotations

from flask import Blueprint, g, request

from middleware.auth_middleware import require_auth
from models import PaymentTransaction, db
from subscription_service import (
    apply_payment_failed,
    apply_payment_success,
    get_patient_subscription,
    patient_has_module_access,
    subscription_to_dict,
)
from utils.razorpay_client import verify_payment_signature
from utils.response_helper import error, success

payments_bp = Blueprint("payments", __name__)


def _require_patient():
    if getattr(g, "user_type", None) != "patient":
        return error("forbidden", "Patient access only", status=403)
    return None


@payments_bp.post("/verify")
@require_auth
def verify_payment():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    data = request.get_json(silent=True) or {}
    payment_id = str(data.get("razorpay_payment_id", "")).strip()
    order_id = str(data.get("razorpay_order_id", "")).strip()
    signature = str(data.get("razorpay_signature", "mock_sig_ok")).strip()

    if not payment_id or not order_id:
        return error("validation_error", "razorpay_payment_id and razorpay_order_id required", status=400)

    txn = PaymentTransaction.query.filter_by(
        patient_id=p.id, razorpay_order_id=order_id, status="INITIATED"
    ).first()
    if not txn:
        txn = (
            PaymentTransaction.query.filter_by(patient_id=p.id, status="INITIATED")
            .order_by(PaymentTransaction.initiated_at.desc())
            .first()
        )
    if not txn:
        return error("not_found", "No pending payment for this order", status=404)

    sub = get_patient_subscription(p.id)
    if not sub or (txn.subscription_id and txn.subscription_id != sub.id):
        sub = get_patient_subscription(p.id)

    if not verify_payment_signature(order_id, payment_id, signature):
        if sub:
            apply_payment_failed(sub, txn, reason="Signature verification failed")
        else:
            txn.status = "FAILED"
            txn.failure_reason = "Signature verification failed"
        db.session.commit()
        return error("payment_failed", "Payment verification failed", status=402)

    if sub:
        apply_payment_success(
            sub,
            txn,
            razorpay_payment_id=payment_id,
            razorpay_order_id=order_id,
        )
        p.is_commercial_subscriber = True
        db.session.add(p)
    else:
        txn.status = "SUCCESS"
        txn.razorpay_payment_id = payment_id

    db.session.commit()
    allowed, _ = patient_has_module_access(sub) if sub else (False, "")

    return success(
        {
            "success": True,
            "subscription_active": allowed,
            "subscription": subscription_to_dict(sub) if sub else None,
        }
    )


@payments_bp.get("/history")
@require_auth
def payment_history():
    err = _require_patient()
    if err:
        return err
    p = g.current_user
    rows = (
        PaymentTransaction.query.filter_by(patient_id=p.id)
        .order_by(PaymentTransaction.initiated_at.desc())
        .limit(50)
        .all()
    )
    items = [
        {
            "id": r.id,
            "subscription_id": r.subscription_id,
            "transaction_type": r.transaction_type,
            "amount_rs": r.amount_rs,
            "currency": r.currency or "INR",
            "status": r.status,
            "razorpay_payment_id": r.razorpay_payment_id,
            "razorpay_order_id": r.razorpay_order_id,
            "initiated_at": r.initiated_at.isoformat() if r.initiated_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "failure_reason": r.failure_reason,
        }
        for r in rows
    ]
    return success({"items": items})
