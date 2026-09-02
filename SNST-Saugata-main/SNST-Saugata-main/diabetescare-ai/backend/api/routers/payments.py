from typing import Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database.session import get_db
from backend.database.models import PaymentTransaction, Patient
from backend.api.middleware import get_current_patient
from backend.database.subscription_service import (
    apply_payment_failed,
    apply_payment_success,
    get_patient_subscription,
    patient_has_module_access,
    subscription_to_dict,
)
from backend.utils.razorpay_client import verify_payment_signature
from backend.utils.legacy_response import success, error

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


def _require_patient(p: Patient):
    # This is handled by FastAPI Depends(get_current_patient) which ensures it's a patient
    pass


@router.post("/verify")
async def verify_payment(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    payment_id = str(data.get("razorpay_payment_id", "")).strip()
    order_id = str(data.get("razorpay_order_id", "")).strip()
    signature = str(data.get("razorpay_signature", "mock_sig_ok")).strip()

    if not payment_id or not order_id:
        return error("validation_error", "razorpay_payment_id and razorpay_order_id required", status=400)

    txn = db.query(PaymentTransaction).filter_by(
        patient_id=p.patient_id, razorpay_order_id=order_id, status="INITIATED"
    ).first()
    
    if not txn:
        txn = (
            db.query(PaymentTransaction).filter_by(patient_id=p.patient_id, status="INITIATED")
            .order_by(desc(PaymentTransaction.initiated_at))
            .first()
        )
        
    if not txn:
        return error("not_found", "No pending payment for this order", status=404)

    sub = get_patient_subscription(db, str(p.patient_id))
    if not sub or (txn.subscription_id and txn.subscription_id != str(sub.subscription_id)):
        sub = get_patient_subscription(db, str(p.patient_id))

    if not verify_payment_signature(order_id, payment_id, signature):
        if sub:
            apply_payment_failed(db, sub, txn, reason="Signature verification failed")
        else:
            txn.status = "FAILED"
            txn.failure_reason = "Signature verification failed"
        db.commit()
        return error("payment_failed", "Payment verification failed", status=402)

    if sub:
        apply_payment_success(
            db,
            sub,
            txn,
            razorpay_payment_id=payment_id,
            razorpay_order_id=order_id,
        )
        p.is_commercial_subscriber = True
        db.add(p)
    else:
        txn.status = "SUCCESS"
        txn.razorpay_payment_id = payment_id

    db.commit()
    allowed, _ = patient_has_module_access(db, sub) if sub else (False, "")

    return success(
        {
            "success": True,
            "subscription_active": allowed,
            "subscription": subscription_to_dict(db, sub) if sub else None,
        }
    )


@router.get("/history")
async def payment_history(
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    rows = (
        db.query(PaymentTransaction).filter_by(patient_id=p.patient_id)
        .order_by(desc(PaymentTransaction.initiated_at))
        .limit(50)
        .all()
    )
    items = [
        {
            "id": str(r.transaction_id),
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
