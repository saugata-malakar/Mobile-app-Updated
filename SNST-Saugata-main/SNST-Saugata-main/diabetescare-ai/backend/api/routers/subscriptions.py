import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import Subscription, SubscriptionTier, PaymentTransaction, Patient
from backend.api.middleware import get_current_patient
from backend.database.subscription_service import (
    apply_cancel,
    apply_pause,
    create_or_prepare_subscription,
    get_patient_subscription,
    patient_has_module_access,
    subscription_to_dict,
    tier_by_id,
    tier_by_name,
    tier_to_dict,
)
from backend.utils.razorpay_client import create_order
from backend.utils.legacy_response import success, error

router = APIRouter(prefix="/api/v1/subscriptions", tags=["subscriptions"])


@router.get("/tiers")
async def list_tiers(db: Session = Depends(get_db)):
    tiers = db.query(SubscriptionTier).filter_by(is_active=True).order_by(SubscriptionTier.price_monthly_rs).all()
    return success({"tiers": [tier_to_dict(t) for t in tiers]})


@router.get("/me")
async def my_subscription(
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    sub = get_patient_subscription(db, str(p.patient_id))
    if not sub:
        return success({"subscription": None, "module_access_allowed": False})
    
    allowed, reason = patient_has_module_access(db, sub)
    data = subscription_to_dict(db, sub)
    data["access_reason"] = reason if not allowed else None
    return success({"subscription": data, "module_access_allowed": allowed})


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_subscription(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    tier_id = data.get("tier_id")
    tier_name = data.get("tier_name") or data.get("tier")

    tier = None
    if tier_id:
        tier = tier_by_id(db, str(tier_id))
    elif tier_name:
        tier = tier_by_name(db, str(tier_name))
        
    if not tier:
        return error("validation_error", "tier_id or tier_name required", status=400)

    sub, txn = create_or_prepare_subscription(db, str(p.patient_id), tier)
    
    order = create_order(
        float(tier.price_monthly_rs or tier.price),
        receipt=str(txn.transaction_id)[:40],
        notes={
            "patient_id": str(p.patient_id),
            "subscription_id": str(sub.subscription_id),
            "txn_id": str(txn.transaction_id)
        },
    )
    txn.razorpay_order_id = order.get("id")
    db.commit()

    return success(
        {
            "subscription_id": str(sub.subscription_id),
            "subscription": subscription_to_dict(db, sub),
            "razorpay_order": order,
            "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID", "rzp_test_mock"),
        },
        status=201,
    )


@router.post("/me/upgrade")
async def upgrade_subscription(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    new_tier_id = data.get("new_tier_id") or data.get("tier_id")
    tier = tier_by_id(db, str(new_tier_id)) if new_tier_id else None
    if not tier:
        return error("validation_error", "new_tier_id required", status=400)

    sub = get_patient_subscription(db, str(p.patient_id))
    if not sub:
        return error("not_found", "No subscription to upgrade", status=404)

    sub.tier_id = tier.tier_id
    sub.amount_rs = float(tier.price_monthly_rs or tier.price)
    
    txn = PaymentTransaction(
        transaction_id=uuid.uuid4(),
        subscription_id=str(sub.subscription_id),
        patient_id=p.patient_id,
        transaction_type="SUBSCRIPTION_UPGRADE",
        amount=float(tier.price_monthly_rs or tier.price),
        amount_rs=float(tier.price_monthly_rs or tier.price),
        currency="INR",
        status="INITIATED",
        transaction_date=datetime.now(timezone.utc),
    )
    db.add(txn)
    db.flush()

    order = create_order(float(tier.price_monthly_rs or tier.price), receipt=str(txn.transaction_id)[:40])
    txn.razorpay_order_id = order.get("id")
    db.commit()

    return success(
        {
            "razorpay_order": order,
            "subscription": subscription_to_dict(db, sub),
            "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID", "rzp_test_mock"),
        }
    )


@router.post("/me/pause")
async def pause_subscription(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    pause_days = int(data.get("pause_days", 7))
    sub = get_patient_subscription(db, str(p.patient_id))
    if not sub:
        return error("not_found", "No subscription", status=404)
        
    try:
        apply_pause(db, sub, pause_days)
    except ValueError as e:
        return error("validation_error", str(e), status=400)
        
    db.commit()
    return success(
        {
            "pause_ends_at": sub.pause_ends_at.isoformat() if sub.pause_ends_at else None,
            "subscription": subscription_to_dict(db, sub),
        }
    )


@router.post("/me/cancel")
async def cancel_subscription(
    request: Request,
    p: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    reason = str(data.get("reason", "")).strip()
    sub = get_patient_subscription(db, str(p.patient_id))
    if not sub:
        return error("not_found", "No subscription", status=404)
        
    try:
        apply_cancel(db, sub, reason)
    except ValueError as e:
        return error("validation_error", str(e), status=400)
        
    db.commit()
    return success(
        {
            "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
            "subscription": subscription_to_dict(db, sub),
        }
    )
