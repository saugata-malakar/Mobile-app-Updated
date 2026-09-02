"""Add D1 subscription / payment columns (idempotent SQLite)."""
from sqlalchemy import inspect, text

from models import db


def _has_column(table: str, column: str) -> bool:
    insp = inspect(db.engine)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade_subscription_d1():
    cols_sub = [
        ("current_period_start", "ALTER TABLE subscriptions ADD COLUMN current_period_start DATETIME"),
        ("next_billing_date", "ALTER TABLE subscriptions ADD COLUMN next_billing_date DATETIME"),
        ("grace_period_ends_at", "ALTER TABLE subscriptions ADD COLUMN grace_period_ends_at DATETIME"),
        ("paused_at", "ALTER TABLE subscriptions ADD COLUMN paused_at DATETIME"),
        ("pause_ends_at", "ALTER TABLE subscriptions ADD COLUMN pause_ends_at DATETIME"),
        ("cancelled_at", "ALTER TABLE subscriptions ADD COLUMN cancelled_at DATETIME"),
        ("cancellation_reason", "ALTER TABLE subscriptions ADD COLUMN cancellation_reason TEXT"),
        ("razorpay_subscription_id", "ALTER TABLE subscriptions ADD COLUMN razorpay_subscription_id TEXT"),
        ("razorpay_customer_id", "ALTER TABLE subscriptions ADD COLUMN razorpay_customer_id TEXT"),
        ("auto_renew", "ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 1"),
    ]
    for name, sql in cols_sub:
        if not _has_column("subscriptions", name):
            db.session.execute(text(sql))

    cols_pay = [
        ("currency", "ALTER TABLE payment_transactions ADD COLUMN currency TEXT DEFAULT 'INR'"),
        ("razorpay_payment_id", "ALTER TABLE payment_transactions ADD COLUMN razorpay_payment_id TEXT"),
        ("razorpay_order_id", "ALTER TABLE payment_transactions ADD COLUMN razorpay_order_id TEXT"),
        ("payment_method", "ALTER TABLE payment_transactions ADD COLUMN payment_method TEXT"),
        ("completed_at", "ALTER TABLE payment_transactions ADD COLUMN completed_at DATETIME"),
        ("failure_reason", "ALTER TABLE payment_transactions ADD COLUMN failure_reason TEXT"),
        ("receipt_gcs_url", "ALTER TABLE payment_transactions ADD COLUMN receipt_gcs_url TEXT"),
    ]
    for name, sql in cols_pay:
        if not _has_column("payment_transactions", name):
            db.session.execute(text(sql))

    db.session.commit()
