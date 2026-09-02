"""Subscription state machine (Phase D1) adapted for FastAPI."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database.models import AppConfig, PaymentTransaction, Subscription, SubscriptionTier

STATUSES = frozenset(
    {
        "TRIAL",
        "ACTIVE",
        "PAYMENT_FAILED",
        "GRACE_PERIOD",
        "SUSPENDED",
        "CANCELLED",
        "EXPIRED",
        "PAUSED",
    }
)

# event -> new status
_TRANSITIONS: dict[str, dict[str, str]] = {
    "TRIAL": {
        "payment_success": "ACTIVE",
        "trial_expire": "EXPIRED",
        "user_cancel": "CANCELLED",
    },
    "ACTIVE": {
        "payment_failed": "PAYMENT_FAILED",
        "user_pause": "PAUSED",
        "user_cancel": "CANCELLED",
        "period_expire": "EXPIRED",
    },
    "PAYMENT_FAILED": {
        "payment_success": "ACTIVE",
        "enter_grace": "GRACE_PERIOD",
        "suspend": "SUSPENDED",
    },
    "GRACE_PERIOD": {
        "payment_success": "ACTIVE",
        "grace_expire": "SUSPENDED",
    },
    "PAUSED": {
        "resume": "ACTIVE",
        "user_cancel": "CANCELLED",
        "pause_expire": "ACTIVE",
    },
    "SUSPENDED": {
        "payment_success": "ACTIVE",
    },
    "EXPIRED": {
        "payment_success": "ACTIVE",
    },
    "CANCELLED": {},
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _config_int(db: Session, key: str, default: int) -> int:
    row = db.query(AppConfig).filter_by(key=key).first()
    if row and row.value:
        try:
            return int(str(row.value).strip())
        except ValueError:
            pass
    return default


def patient_has_module_access(db: Session, sub: Subscription | None) -> tuple[bool, str]:
    """Returns (allowed, reason). Blocks SUSPENDED and EXPIRED per D1."""
    if sub is None:
        return False, "No active subscription"
    now = _utcnow()
    status = (sub.status or "").upper()

    if status == "PAUSED":
        pause_end = _as_utc(sub.pause_ends_at)
        if pause_end and now >= pause_end:
            transition(sub, "pause_expire")
            db.flush()
            status = sub.status
        else:
            return False, "Subscription is paused"

    trial_end = _as_utc(sub.trial_ends_at)
    if status == "TRIAL" and trial_end and now >= trial_end:
        transition(sub, "trial_expire")
        db.flush()
        status = sub.status

    grace_end = _as_utc(sub.grace_period_ends_at)
    if status == "GRACE_PERIOD" and grace_end and now >= grace_end:
        transition(sub, "grace_expire")
        db.flush()
        status = sub.status

    if status in ("SUSPENDED", "EXPIRED", "CANCELLED"):
        return False, f"Subscription is {status.lower().replace('_', ' ')}"

    if status == "PAYMENT_FAILED":
        transition(sub, "enter_grace")
        db.flush()
        if sub.status == "GRACE_PERIOD":
            ge = _as_utc(sub.grace_period_ends_at)
            if ge and now >= ge:
                transition(sub, "grace_expire")
                db.flush()
                return False, "Subscription suspended after grace period"
            return True, ""
        return False, "Payment failed — renew to continue monitoring"

    if status in ("TRIAL", "ACTIVE", "GRACE_PERIOD"):
        return True, ""

    return False, f"Subscription status {status} does not allow access"


def transition(sub: Subscription, event: str) -> str:
    """Apply state machine event; returns new status. Raises ValueError if illegal."""
    cur = (sub.status or "TRIAL").upper()
    event = event.strip().lower()
    mapping = _TRANSITIONS.get(cur, {})
    new_status = mapping.get(event)
    if not new_status:
        raise ValueError(f"Cannot apply event '{event}' from status '{cur}'")
    sub.status = new_status
    sub.updated_at = _utcnow()
    return new_status


def ensure_trial_subscription(db: Session, patient_id: str, tier_name: str = "BASIC") -> Subscription:
    """Auto-start commercial trial on registration (D1)."""
    existing = get_patient_subscription(db, patient_id)
    if existing:
        return existing
    
    # Try looking by tier name or get the first active tier
    tier = tier_by_name(db, tier_name)
    if not tier:
        tier = db.query(SubscriptionTier).filter_by(is_active=True).first()
    
    # If no tiers exist, seed a BASIC tier
    if not tier:
        tier = SubscriptionTier(
            tier_id=uuid.uuid4(),
            name="BASIC",
            tier_name="BASIC",
            price=0.0,
            price_monthly_rs=0.0,
            price_annual_rs=0.0,
            features="[]",
            wound_sessions_per_month=5,
            skin_sessions_per_month=5,
            contributing_factor_sessions_per_quarter=5,
            teleconsult_included_per_month=1,
            is_active=True
        )
        db.add(tier)
        db.flush()

    trial_days = _config_int(db, "trial_days", 3)
    now = _utcnow()
    sub = Subscription(
        subscription_id=uuid.uuid4(),
        patient_id=uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id,
        tier_id=tier.tier_id,
        status="TRIAL",
        trial_ends_at=now + timedelta(days=trial_days),
        started_at=now,
        start_date=now,
        amount_rs=float(tier.price_monthly_rs or 0.0),
        auto_renew=True,
    )
    db.add(sub)
    db.flush()
    return sub


def get_patient_subscription(db: Session, patient_id: str) -> Subscription | None:
    pat_uuid = uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id
    return (
        db.query(Subscription)
        .filter_by(patient_id=pat_uuid)
        .order_by(desc(Subscription.created_at))
        .first()
    )


def tier_by_name(db: Session, name: str) -> SubscriptionTier | None:
    return db.query(SubscriptionTier).filter_by(tier_name=name.upper(), is_active=True).first()


def tier_by_id(db: Session, tier_id: str) -> SubscriptionTier | None:
    t_uuid = uuid.UUID(tier_id) if isinstance(tier_id, str) else tier_id
    return db.query(SubscriptionTier).filter_by(tier_id=t_uuid, is_active=True).first()


def subscription_to_dict(db: Session, sub: Subscription) -> dict:
    tier = sub.tier
    return {
        "id": str(sub.id),
        "patient_id": str(sub.patient_id),
        "tier_id": str(sub.tier_id),
        "tier_name": tier.tier_name if tier else (tier.name if tier else None),
        "status": sub.status,
        "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
        "current_period_start": sub.current_period_start.isoformat()
        if sub.current_period_start
        else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "next_billing_date": sub.next_billing_date.isoformat() if sub.next_billing_date else None,
        "grace_period_ends_at": sub.grace_period_ends_at.isoformat()
        if sub.grace_period_ends_at
        else None,
        "paused_at": sub.paused_at.isoformat() if sub.paused_at else None,
        "pause_ends_at": sub.pause_ends_at.isoformat() if sub.pause_ends_at else None,
        "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
        "amount_rs": sub.amount_rs,
        "auto_renew": bool(sub.auto_renew),
        "module_access_allowed": patient_has_module_access(db, sub)[0],
    }


def tier_to_dict(t: SubscriptionTier) -> dict:
    feats = []
    if t.features:
        try:
            feats = json.loads(t.features)
        except (json.JSONDecodeError, TypeError):
            feats = []
    return {
        "id": str(t.id),
        "tier_name": t.tier_name or t.name,
        "price_monthly_rs": t.price_monthly_rs or t.price,
        "price_annual_rs": t.price_annual_rs or 0.0,
        "wound_sessions_per_month": t.wound_sessions_per_month,
        "skin_sessions_per_month": t.skin_sessions_per_month,
        "contributing_factor_sessions_per_quarter": t.contributing_factor_sessions_per_quarter,
        "teleconsult_included_per_month": t.teleconsult_included_per_month,
        "features": feats,
    }


def _period_end(from_dt: datetime) -> datetime:
    return from_dt + timedelta(days=30)


def create_or_prepare_subscription(db: Session, patient_id: str, tier: SubscriptionTier) -> tuple[Subscription, PaymentTransaction]:
    """Create TRIAL subscription (if none) and payment order for selected tier."""
    existing = get_patient_subscription(db, patient_id)
    pat_uuid = uuid.UUID(patient_id) if isinstance(patient_id, str) else patient_id
    if existing and existing.status not in ("CANCELLED", "EXPIRED"):
        if existing.tier_id != tier.tier_id:
            existing.tier_id = tier.tier_id
            existing.amount_rs = float(tier.price_monthly_rs or tier.price)
            existing.updated_at = _utcnow()
            sub = existing
        else:
            sub = existing
    else:
        trial_days = _config_int(db, "trial_days", 3)
        now = _utcnow()
        sub = Subscription(
            subscription_id=uuid.uuid4(),
            patient_id=pat_uuid,
            tier_id=tier.tier_id,
            status="TRIAL",
            trial_ends_at=now + timedelta(days=trial_days),
            started_at=now,
            start_date=now,
            amount_rs=float(tier.price_monthly_rs or tier.price),
            auto_renew=True,
        )
        db.add(sub)

    txn = PaymentTransaction(
        transaction_id=uuid.uuid4(),
        subscription_id=str(sub.id),
        patient_id=pat_uuid,
        transaction_type="SUBSCRIPTION_NEW",
        amount=float(tier.price_monthly_rs or tier.price),
        amount_rs=float(tier.price_monthly_rs or tier.price),
        currency="INR",
        status="INITIATED",
        transaction_date=_utcnow(),
    )
    db.add(txn)
    db.flush()
    return sub, txn


def apply_payment_success(
    db: Session,
    sub: Subscription,
    txn: PaymentTransaction,
    *,
    razorpay_payment_id: str | None = None,
    razorpay_order_id: str | None = None,
) -> None:
    now = _utcnow()
    cur = (sub.status or "TRIAL").upper()
    if cur in ("TRIAL", "EXPIRED", "PAYMENT_FAILED", "GRACE_PERIOD", "SUSPENDED"):
        if cur != "ACTIVE":
            transition(sub, "payment_success")
    elif cur == "PAUSED":
        transition(sub, "resume")

    sub.started_at = sub.started_at or now
    sub.current_period_start = now
    sub.current_period_end = _period_end(now)
    sub.next_billing_date = sub.current_period_end
    sub.grace_period_ends_at = None
    sub.paused_at = None
    sub.pause_ends_at = None

    txn.status = "SUCCESS"
    txn.completed_at = now
    if razorpay_payment_id:
        txn.razorpay_payment_id = razorpay_payment_id
    if razorpay_order_id:
        txn.razorpay_order_id = razorpay_order_id
    sub.updated_at = now


def apply_payment_failed(db: Session, sub: Subscription, txn: PaymentTransaction, reason: str = "") -> None:
    cur = (sub.status or "").upper()
    if cur == "ACTIVE":
        transition(sub, "payment_failed")
    elif cur == "GRACE_PERIOD":
        transition(sub, "grace_expire")
    txn.status = "FAILED"
    txn.failure_reason = reason or "Payment failed"
    txn.completed_at = _utcnow()
    sub.updated_at = _utcnow()


def apply_pause(db: Session, sub: Subscription, pause_days: int) -> None:
    if pause_days < 1 or pause_days > 30:
        raise ValueError("pause_days must be between 1 and 30")
    transition(sub, "user_pause")
    now = _utcnow()
    sub.paused_at = now
    sub.pause_ends_at = now + timedelta(days=pause_days)
    sub.updated_at = now


def apply_cancel(db: Session, sub: Subscription, reason: str = "") -> None:
    transition(sub, "user_cancel")
    now = _utcnow()
    sub.cancelled_at = now
    sub.cancellation_reason = reason
    sub.auto_renew = False
    sub.updated_at = now


def start_grace_period(db: Session, sub: Subscription) -> None:
    days = _config_int(db, "grace_period_days", 7)
    now = _utcnow()
    if (sub.status or "").upper() == "PAYMENT_FAILED":
        transition(sub, "enter_grace")
    sub.grace_period_ends_at = now + timedelta(days=days)
    sub.updated_at = now
