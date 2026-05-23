"""Phase A schema additions (26-table target). Uses DateTime(UTC) to match existing ORM style."""
import uuid
from datetime import datetime, timezone

from . import db


def _utcnow():
    return datetime.now(timezone.utc)


class SubscriptionTier(db.Model):
    __tablename__ = "subscription_tiers"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tier_name = db.Column(db.String(20), nullable=False)
    price_monthly_rs = db.Column(db.Float, nullable=False)
    price_annual_rs = db.Column(db.Float)
    wound_sessions_per_month = db.Column(db.Integer)
    skin_sessions_per_month = db.Column(db.Integer)
    contributing_factor_sessions_per_quarter = db.Column(db.Integer)
    teleconsult_included_per_month = db.Column(db.Integer, default=0)
    features = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)


class AppConfig(db.Model):
    __tablename__ = "app_config"

    config_key = db.Column("key", db.String(80), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    updated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)


class PatientMedicalHistory(db.Model):
    __tablename__ = "patient_medical_history"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    version_number = db.Column(db.Integer, nullable=False, default=1)
    recorded_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    recorded_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    diabetes_type = db.Column(db.String(20))
    diabetes_duration_years = db.Column(db.Float)
    hba1c_value = db.Column(db.Float)
    hba1c_date = db.Column(db.String(32))
    has_hypertension = db.Column(db.Boolean, default=False)
    has_ckd = db.Column(db.Boolean, default=False)
    has_cad = db.Column(db.Boolean, default=False)
    retinopathy_known = db.Column(db.Boolean, default=False)
    neuropathy_known = db.Column(db.Boolean, default=False)
    previous_dfu = db.Column(db.Boolean, default=False)
    previous_dfu_count = db.Column(db.Integer, default=0)
    previous_amputation = db.Column(db.Boolean, default=False)
    amputation_site = db.Column(db.String(200))
    current_medications = db.Column(db.Text)
    smoking_status = db.Column(db.String(20))
    bmi = db.Column(db.Float)
    weight_kg = db.Column(db.Float)
    bp_systolic = db.Column(db.Integer)
    bp_diastolic = db.Column(db.Integer)
    notes = db.Column(db.Text)


class WoundSite(db.Model):
    __tablename__ = "wound_sites"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    foot_side = db.Column(db.String(20), nullable=False)
    location_on_foot = db.Column(db.String(40), nullable=False)
    toe_number = db.Column(db.Integer)
    first_detected_date = db.Column(db.String(32), nullable=False)
    status = db.Column(db.String(40), default="ACTIVE")
    healed_date = db.Column(db.String(32))
    initial_wagner_grade = db.Column(db.Integer)
    current_wagner_grade = db.Column(db.Integer)
    is_primary_site = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    created_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    last_session_at = db.Column(db.DateTime(timezone=True))
    total_sessions = db.Column(db.Integer, default=0)


class PatientConsent(db.Model):
    __tablename__ = "consents"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    consent_version = db.Column(db.String(20), nullable=False)
    consent_type = db.Column(db.String(40), nullable=False)
    signed_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    signed_by_method = db.Column(db.String(40))
    witnessed_by_asha_id = db.Column(db.String(36), db.ForeignKey("asha_workers.id"))
    modules_consented = db.Column(db.Text, nullable=False)
    withdrawal_at = db.Column(db.DateTime(timezone=True))
    withdrawal_reason = db.Column(db.Text)
    digital_signature_hash = db.Column(db.String(128))
    consent_document_gcs_url = db.Column(db.String(512))
    is_active = db.Column(db.Boolean, default=True)


class MonitoringSession(db.Model):
    __tablename__ = "monitoring_sessions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    wound_site_id = db.Column(db.String(36), db.ForeignKey("wound_sites.id"))
    session_type = db.Column(db.String(40), nullable=False)
    track = db.Column(db.String(20), nullable=False)
    scheduled_date = db.Column(db.String(32))
    submitted_at = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(40), default="SUBMITTED")
    submitted_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    submission_method = db.Column(db.String(30))
    is_offline_captured = db.Column(db.Boolean, default=False)
    offline_captured_at = db.Column(db.DateTime(timezone=True))
    offline_uploaded_at = db.Column(db.DateTime(timezone=True))
    conflict_status = db.Column(db.String(40), default="NONE")
    primary_session_id = db.Column(db.String(36), db.ForeignKey("monitoring_sessions.id"))
    session_notes = db.Column(db.Text)
    ai_processing_started_at = db.Column(db.DateTime(timezone=True))
    ai_processing_completed_at = db.Column(db.DateTime(timezone=True))


class Photograph(db.Model):
    __tablename__ = "photographs"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = db.Column(db.String(36), db.ForeignKey("monitoring_sessions.id"), nullable=False, index=True)
    angle = db.Column(db.String(40), nullable=False)
    captured_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    device_id = db.Column(db.String(120))
    gcs_url = db.Column(db.String(512))
    thumbnail_gcs_url = db.Column(db.String(512))
    file_size_bytes = db.Column(db.Integer)
    quality_score = db.Column(db.Float)
    upload_status = db.Column(db.String(20), default="PENDING")
    sequence_number = db.Column(db.Integer)


class AiResult(db.Model):
    __tablename__ = "ai_results"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = db.Column(db.String(36), db.ForeignKey("monitoring_sessions.id"), unique=True, nullable=False)
    model_version = db.Column(db.String(40), nullable=False)
    processed_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    processing_method = db.Column(db.String(30))
    overall_confidence = db.Column(db.Float)
    wound_area_cm2 = db.Column(db.Float)
    wagner_grade = db.Column(db.Integer)
    alert_level = db.Column(db.String(10))
    # JSON string: modality-specific AI fields merged into API (Phase C2 skin, etc.).
    details_json = db.Column(db.Text)


class Alert(db.Model):
    __tablename__ = "alerts"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = db.Column(db.String(36), db.ForeignKey("monitoring_sessions.id"))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    wound_site_id = db.Column(db.String(36), db.ForeignKey("wound_sites.id"))
    alert_level = db.Column(db.String(10), nullable=False)
    alert_type = db.Column(db.String(60), nullable=False)
    generated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    message_patient_en = db.Column(db.Text)
    message_patient_bn = db.Column(db.Text)
    message_doctor_en = db.Column(db.Text)
    resolved_at = db.Column(db.DateTime(timezone=True))
    acknowledgement_note = db.Column(db.Text)
    escalation_level = db.Column(db.Integer, default=0, nullable=False)
    escalation_at = db.Column(db.DateTime(timezone=True))


class AshaPatientAssignment(db.Model):
    __tablename__ = "asha_patient_assignments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asha_id = db.Column(db.String(36), db.ForeignKey("asha_workers.id"), nullable=False, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    assigned_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    assignment_type = db.Column(db.String(20), default="PRIMARY")
    is_active = db.Column(db.Boolean, default=True)
    geographic_verified = db.Column(db.Boolean, default=False)


class AshaCommissionLedger(db.Model):
    __tablename__ = "asha_commissions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asha_id = db.Column(db.String(36), db.ForeignKey("asha_workers.id"), nullable=False, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"))
    session_id = db.Column(db.String(36), db.ForeignKey("monitoring_sessions.id"))
    commission_type = db.Column(db.String(40), nullable=False)
    amount_rs = db.Column(db.Float, nullable=False)
    earned_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    payment_status = db.Column(db.String(20), default="PENDING")


class AshaTrainingModule(db.Model):
    __tablename__ = "asha_training_modules"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asha_id = db.Column(db.String(36), db.ForeignKey("asha_workers.id"), nullable=False, index=True)
    module_code = db.Column(db.String(60), nullable=False)
    completed_at = db.Column(db.DateTime(timezone=True))
    score = db.Column(db.Float)
    attempts = db.Column(db.Integer, default=0)
    passed = db.Column(db.Boolean, default=False)


class DoctorPatientAssignment(db.Model):
    __tablename__ = "doctor_patient_assignments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id = db.Column(db.String(36), db.ForeignKey("doctors.id"), nullable=False, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    wound_site_id = db.Column(db.String(36), db.ForeignKey("wound_sites.id"))
    assigned_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    assignment_type = db.Column(db.String(30), default="PRIMARY")
    is_active = db.Column(db.Boolean, default=True)


class TeleconsultRequest(db.Model):
    __tablename__ = "teleconsult_requests"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    session_id = db.Column(db.String(36), db.ForeignKey("monitoring_sessions.id"))
    alert_id = db.Column(db.String(36), db.ForeignKey("alerts.id"))
    request_type = db.Column(db.String(20), nullable=False)
    requested_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    patient_concern_en = db.Column(db.Text)
    patient_concern_bn = db.Column(db.Text)
    preferred_callback_time = db.Column(db.String(64))
    estimated_callback_at = db.Column(db.DateTime(timezone=True))
    scheduled_at = db.Column(db.DateTime(timezone=True))
    assigned_at = db.Column(db.DateTime(timezone=True))
    actual_call_at = db.Column(db.DateTime(timezone=True))
    call_duration_minutes = db.Column(db.Integer)
    doctor_notes = db.Column(db.Text)
    patient_rating = db.Column(db.Integer)
    patient_feedback = db.Column(db.Text)
    cancelled_at = db.Column(db.DateTime(timezone=True))
    prescription_json = db.Column(db.Text)
    status = db.Column(db.String(20), default="PENDING")
    assigned_doctor_id = db.Column(db.String(36), db.ForeignKey("doctors.id"))


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    tier_id = db.Column(db.String(36), db.ForeignKey("subscription_tiers.id"), nullable=False)
    status = db.Column(db.String(30), nullable=False, default="TRIAL")
    trial_ends_at = db.Column(db.DateTime(timezone=True))
    started_at = db.Column(db.DateTime(timezone=True))
    current_period_start = db.Column(db.DateTime(timezone=True))
    current_period_end = db.Column(db.DateTime(timezone=True))
    next_billing_date = db.Column(db.DateTime(timezone=True))
    grace_period_ends_at = db.Column(db.DateTime(timezone=True))
    paused_at = db.Column(db.DateTime(timezone=True))
    pause_ends_at = db.Column(db.DateTime(timezone=True))
    cancelled_at = db.Column(db.DateTime(timezone=True))
    cancellation_reason = db.Column(db.Text)
    razorpay_subscription_id = db.Column(db.String(80))
    razorpay_customer_id = db.Column(db.String(80))
    auto_renew = db.Column(db.Boolean, default=True, nullable=False)
    amount_rs = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    tier = db.relationship("SubscriptionTier", lazy="joined")


class PaymentTransaction(db.Model):
    __tablename__ = "payment_transactions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subscription_id = db.Column(db.String(36), db.ForeignKey("subscriptions.id"))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    transaction_type = db.Column(db.String(40), nullable=False)
    amount_rs = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(8), default="INR")
    status = db.Column(db.String(30), nullable=False)
    razorpay_payment_id = db.Column(db.String(80))
    razorpay_order_id = db.Column(db.String(80))
    payment_method = db.Column(db.String(20))
    initiated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    completed_at = db.Column(db.DateTime(timezone=True))
    failure_reason = db.Column(db.Text)
    receipt_gcs_url = db.Column(db.String(512))


class SessionSchedule(db.Model):
    __tablename__ = "session_schedule"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey("patients.id"), nullable=False, index=True)
    wound_site_id = db.Column(db.String(36), db.ForeignKey("wound_sites.id"))
    session_type = db.Column(db.String(40), nullable=False)
    subscription_id = db.Column(db.String(36), db.ForeignKey("subscriptions.id"))
    scheduled_date = db.Column(db.String(32), nullable=False)
    due_by_date = db.Column(db.String(32), nullable=False)
    status = db.Column(db.String(20), default="UPCOMING")
    reminder_1_sent_at = db.Column(db.DateTime(timezone=True))
    reminder_2_sent_at = db.Column(db.DateTime(timezone=True))
    overdue_alert_sent_at = db.Column(db.DateTime(timezone=True))
    completed_session_id = db.Column(db.String(36), db.ForeignKey("monitoring_sessions.id"))
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipient_user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    notification_type = db.Column(db.String(40), nullable=False)
    title_en = db.Column(db.String(200), nullable=False)
    title_bn = db.Column(db.String(200))
    body_en = db.Column(db.Text, nullable=False)
    body_bn = db.Column(db.Text)
    deep_link = db.Column(db.String(512))
    data = db.Column(db.Text)
    channel = db.Column(db.String(10), nullable=False)
    sent_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    fcm_message_id = db.Column(db.String(120))
    sms_message_id = db.Column(db.String(120))
    read_at = db.Column(db.DateTime(timezone=True))
    action_taken = db.Column(db.Boolean, default=False, nullable=False)


class NotificationPreference(db.Model):
    __tablename__ = "notification_preferences"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), unique=True, nullable=False)
    session_reminder_days_before = db.Column(db.Text, default="[1]")
    session_reminder_time = db.Column(db.String(8), default="09:00")
    overdue_reminder_enabled = db.Column(db.Boolean, default=True, nullable=False)
    overdue_reminder_after_days = db.Column(db.Integer, default=2, nullable=False)
    alert_sms_enabled = db.Column(db.Boolean, default=True)
    alert_push_enabled = db.Column(db.Boolean, default=True)
    payment_notifications_enabled = db.Column(db.Boolean, default=True, nullable=False)
    prescription_notifications_enabled = db.Column(db.Boolean, default=True, nullable=False)
    marketing_enabled = db.Column(db.Boolean, default=False, nullable=False)
    language = db.Column(db.String(5), default="en")


class ResearchExport(db.Model):
    __tablename__ = "research_exports"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    exported_by_user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    export_type = db.Column(db.String(40), nullable=False)
    export_params = db.Column(db.Text)
    generated_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    record_count = db.Column(db.Integer)
