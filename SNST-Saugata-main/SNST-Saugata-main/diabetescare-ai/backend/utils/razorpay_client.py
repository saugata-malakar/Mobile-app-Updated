"""Razorpay order creation and signature verification (test keys in dev)."""
from __future__ import annotations

import hashlib
import hmac
import os
import uuid


def _mock_mode() -> bool:
    return os.environ.get("RAZORPAY_MOCK", "1").lower() in ("1", "true", "yes") or not os.environ.get(
        "RAZORPAY_KEY_SECRET"
    )


def create_order(amount_rs: float, receipt: str, notes: dict | None = None) -> dict:
    amount_paise = int(round(float(amount_rs) * 100))
    if _mock_mode():
        return {
            "id": f"order_test_{uuid.uuid4().hex[:14]}",
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "status": "created",
            "notes": notes or {},
        }

    import razorpay

    client = razorpay.Client(
        auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"])
    )
    return client.order.create(
        {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "notes": notes or {},
        }
    )


def verify_payment_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    if not razorpay_order_id or not razorpay_payment_id:
        return False

    if razorpay_payment_id == "pay_failed_test":
        return False

    if _mock_mode():
        if razorpay_signature in ("", "mock_sig_fail"):
            return False
        return True

    secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    payload = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, razorpay_signature or "")
