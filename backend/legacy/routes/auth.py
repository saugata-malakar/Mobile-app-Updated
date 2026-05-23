import bcrypt
import uuid
from datetime import date, datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from middleware.auth_middleware import require_admin
from middleware.rate_limiter import limiter
from models import Admin, AshaWorker, AuditLog, Device, Patient, User, db
from utils.jwt_helper import make_tokens
from utils.response_helper import error, success
from utils.validators import sanitise_string, validate_age, validate_gender, validate_phone

auth_bp = Blueprint("auth", __name__)


def _utcnow():
    return datetime.now(timezone.utc)


def _map_api_gender(g: str | None) -> str | None:
    if not g:
        return None
    m = {"male": "Male", "female": "Female", "other": "Other", "prefer_not_to_say": "Other"}
    return m.get(str(g).lower().strip())


def _age_from_dob(iso_date: str) -> int:
    d = date.fromisoformat(str(iso_date)[:10])
    today = date.today()
    return today.year - d.year - ((today.month, today.day) < (d.month, d.day))


def _register_device(owner_id: str, owner_type: str):
    device_id = request.headers.get("X-Device-ID")
    if not device_id:
        return
    dev = Device.query.filter_by(device_id=device_id).first()
    if dev:
        dev.owner_id = owner_id
        dev.owner_type = owner_type
        dev.last_seen = _utcnow()
    else:
        db.session.add(
            Device(
                device_id=device_id,
                owner_id=owner_id,
                owner_type=owner_type,
                platform="android",
                registered_at=_utcnow(),
                last_seen=_utcnow(),
            )
        )


def _audit(user_id: str, user_type: str, action: str):
    db.session.add(
        AuditLog(
            user_id=user_id,
            user_type=user_type,
            action=action,
            resource_type="auth",
            ip_address=request.remote_addr,
            status_code=200,
            created_at=_utcnow(),
        )
    )


@auth_bp.post("/register")
@limiter.limit("5 per hour")
def api_register():
    """Spec-style patient registration with password + User row (Phase A)."""
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone_number", data.get("phone", ""))).strip()
    password = str(data.get("password", "")).strip()
    full_name = sanitise_string(data.get("full_name", data.get("name")))
    dob = str(data.get("date_of_birth", "")).strip()
    gender_raw = data.get("gender")
    village = sanitise_string(data.get("village"))
    block = sanitise_string(data.get("block")) or None
    district = sanitise_string(data.get("district")) or None
    pin_code = sanitise_string(data.get("pin_code")) or None
    emergency_contact_name = sanitise_string(data.get("emergency_contact_name")) or None
    emergency_contact_phone = str(data.get("emergency_contact_phone", "")).strip() or None
    abha_id = sanitise_string(data.get("abha_id")) or None
    preferred_language = str(data.get("preferred_language", "en")).lower()[:5] or "en"
    role = str(data.get("role", "patient")).lower()

    if role != "patient":
        return error("validation_error", "Only patient registration is supported here", status=400)
    if not validate_phone(phone):
        return error("validation_error", "Phone must be exactly 10 digits", status=400)
    if len(password) < 6:
        return error("validation_error", "Password must be at least 6 characters", status=400)
    if not full_name:
        return error("validation_error", "full_name is required", status=400)
    if not dob:
        return error("validation_error", "date_of_birth is required (ISO YYYY-MM-DD)", status=400)
    try:
        age = _age_from_dob(dob)
    except ValueError:
        return error("validation_error", "Invalid date_of_birth", status=400)
    if not validate_age(age):
        return error("validation_error", "Derived age must be between 1 and 120", status=400)
    gender = _map_api_gender(gender_raw)
    if not gender or not validate_gender(gender):
        return error("validation_error", "gender must be male, female, other, or prefer_not_to_say", status=400)
    if not village:
        return error("validation_error", "village is required", status=400)

    if User.query.filter_by(phone_number=phone).first() or Patient.query.filter_by(phone=phone).first():
        return error("duplicate", "Phone already registered", status=409)

    pwd_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(
        id=str(uuid.uuid4()),
        phone_number=phone,
        hashed_password=pwd_hash,
        role="patient",
        is_active=True,
        preferred_language=preferred_language if preferred_language in ("en", "bn") else "en",
    )
    db.session.add(user)
    db.session.flush()

    patient = Patient(
        user_id=user.id,
        name=full_name,
        phone=phone,
        age=int(age),
        gender=gender,
        village=village,
        district=district,
        block=block,
        pin_code=pin_code,
        date_of_birth=dob[:32],
        emergency_contact_name=emergency_contact_name,
        emergency_contact_phone=emergency_contact_phone,
        abha_id=abha_id,
        preferred_language=preferred_language if preferred_language in ("en", "bn") else "en",
        password_hash=pwd_hash,
        consent_given_at=_utcnow(),
    )
    db.session.add(patient)
    db.session.flush()
    _register_device(patient.id, "patient")
    access, refresh = make_tokens(patient.id, "patient")
    _audit(patient.id, "patient", "api_register")
    db.session.commit()

    return success(
        {
            "user_id": user.id,
            "token": access,
            "refresh_token": refresh,
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "phone": patient.phone,
                "age": patient.age,
                "gender": patient.gender,
                "village": patient.village,
            },
        },
        status=201,
    )


@auth_bp.post("/patient/register")
@limiter.limit("5 per hour")
def patient_register():
    data = request.get_json(silent=True) or {}
    name = sanitise_string(data.get("name"))
    phone = str(data.get("phone", "")).strip()
    age = data.get("age")
    gender = data.get("gender")
    village = sanitise_string(data.get("village"))
    password = str(data.get("password", "")).strip()
    block = sanitise_string(data.get("block")) or None
    district = sanitise_string(data.get("district")) or None
    pin_code = sanitise_string(data.get("pin_code")) or None
    dob = str(data.get("date_of_birth", "")).strip() or None
    emergency_contact_name = sanitise_string(data.get("emergency_contact_name")) or None
    emergency_contact_phone = str(data.get("emergency_contact_phone", "")).strip() or None
    preferred_language = str(data.get("preferred_language", "en")).lower()[:5] or "en"

    if not name:
        return error("validation_error", "Name is required", status=400)
    if not validate_phone(phone):
        return error("validation_error", "Phone must be exactly 10 digits", status=400)
    if not validate_age(age):
        return error("validation_error", "Age must be between 1 and 120", status=400)
    if not validate_gender(gender):
        return error("validation_error", "Gender must be Male, Female, or Other", status=400)
    if not village:
        return error("validation_error", "Village is required", status=400)

    if Patient.query.filter_by(phone=phone).first():
        return error("duplicate", "Phone already registered", status=409)

    pwd_hash = None
    user_id = None
    if password:
        if len(password) < 6:
            return error("validation_error", "Password must be at least 6 characters", status=400)
        pwd_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user = User(
            id=str(uuid.uuid4()),
            phone_number=phone,
            hashed_password=pwd_hash,
            role="patient",
            is_active=True,
            preferred_language=preferred_language if preferred_language in ("en", "bn") else "en",
        )
        db.session.add(user)
        db.session.flush()
        user_id = user.id

    patient = Patient(
        user_id=user_id,
        name=name,
        phone=phone,
        age=int(age),
        gender=gender,
        village=village,
        district=district,
        block=block,
        pin_code=pin_code,
        date_of_birth=dob,
        emergency_contact_name=emergency_contact_name,
        emergency_contact_phone=emergency_contact_phone,
        preferred_language=preferred_language if preferred_language in ("en", "bn") else "en",
        password_hash=pwd_hash,
        consent_given_at=_utcnow(),
    )
    db.session.add(patient)
    db.session.flush()
    from subscription_service import ensure_trial_subscription

    ensure_trial_subscription(patient.id)
    _register_device(patient.id, "patient")
    access, refresh = make_tokens(patient.id, "patient")
    _audit(patient.id, "patient", "patient_register")
    db.session.commit()

    return success(
        {
            "token": access,
            "refresh_token": refresh,
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "phone": patient.phone,
                "age": patient.age,
                "gender": patient.gender,
                "village": patient.village,
            },
        },
        status=201,
    )


@auth_bp.post("/patient/login")
@limiter.limit("10 per hour")
def patient_login():
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    password = str(data.get("password", "")).strip()
    if not validate_phone(phone):
        return error("validation_error", "Invalid phone", status=400)

    patient = Patient.query.filter_by(phone=phone).first()
    if not patient:
        return error("not_found", "Patient not found", status=404)

    if patient.password_hash:
        if not password:
            return error("validation_error", "Password is required for this account", status=400)
        if not bcrypt.checkpw(password.encode("utf-8"), patient.password_hash.encode("utf-8")):
            return error("unauthorized", "Invalid credentials", status=401)

    patient.last_login = _utcnow()
    device_id = request.headers.get("X-Device-ID")
    if device_id:
        dev = Device.query.filter_by(device_id=device_id).first()
        if dev:
            dev.last_seen = _utcnow()
    db.session.add(patient)
    access, refresh = make_tokens(patient.id, "patient")
    _audit(patient.id, "patient", "patient_login")
    db.session.commit()

    return success(
        {
            "token": access,
            "refresh_token": refresh,
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "phone": patient.phone,
                "age": patient.age,
                "gender": patient.gender,
                "village": patient.village,
            },
        },
        status=200,
    )


@auth_bp.post("/asha/login")
@limiter.limit("10 per hour")
def asha_login():
    data = request.get_json(silent=True) or {}
    worker_id = str(data.get("worker_id", "")).strip().lower()
    pin = str(data.get("pin", "")).strip()
    if not worker_id or not pin:
        return error("validation_error", "worker_id and pin required", status=400)

    worker = AshaWorker.query.filter(db.func.lower(AshaWorker.worker_id) == worker_id).first()
    if not worker:
        return error("unauthorized", "Invalid credentials", status=401)

    if not bcrypt.checkpw(pin.encode("utf-8"), worker.pin_hash.encode("utf-8")):
        return error("unauthorized", "Invalid credentials", status=401)

    if not worker.active:
        return error("forbidden", "Inactive worker", status=403)

    device_header = request.headers.get("X-Device-ID")
    if device_header:
        worker.device_id = device_header

    access, refresh = make_tokens(worker.id, "asha_worker")
    _audit(worker.id, "asha_worker", "asha_login")
    db.session.commit()

    return success(
        {
            "token": access,
            "refresh_token": refresh,
            "asha": {
                "id": worker.id,
                "worker_id": worker.worker_id,
                "name": worker.name,
                "village": worker.village,
                "district": worker.district,
            },
        },
        status=200,
    )


@auth_bp.post("/doctor/login")
@limiter.limit("10 per hour")
def doctor_login():
    """Doctor web dashboard — rejects non-doctor accounts."""
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", "")).strip()
    if not email or not password:
        return error("validation_error", "email and password required", status=400)

    from models import Doctor

    doc = Doctor.query.filter(db.func.lower(Doctor.email) == email).first()
    if not doc or not bcrypt.checkpw(password.encode("utf-8"), doc.password_hash.encode("utf-8")):
        return error("unauthorized", "Invalid credentials", status=401)
    if not doc.active:
        return error("forbidden", "Inactive doctor account", status=403)

    access, refresh = make_tokens(doc.id, "doctor")
    _audit(doc.id, "doctor", "doctor_login")
    db.session.commit()

    return success(
        {
            "token": access,
            "refresh_token": refresh,
            "role": "doctor",
            "user_id": doc.id,
            "doctor": {
                "id": doc.id,
                "name": doc.name,
                "email": doc.email,
                "specialisation": doc.specialisation,
                "hospital_name": doc.hospital_name,
                "hospital_department": doc.hospital_department,
            },
        },
        status=200,
    )


@auth_bp.post("/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    admin = Admin.query.filter(db.func.lower(Admin.email) == email).first()
    if not admin or not bcrypt.checkpw(password.encode("utf-8"), admin.password_hash.encode("utf-8")):
        return error("unauthorized", "Invalid credentials", status=401)
    if not admin.active:
        return error("forbidden", "Inactive admin", status=403)

    access, refresh = make_tokens(admin.id, "admin")
    _audit(admin.id, "admin", "admin_login")
    db.session.commit()
    return success({"token": access, "refresh_token": refresh}, status=200)


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh_token():
    uid = str(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get("user_type")
    if not user_type:
        return error("unauthorized", "Invalid claims", status=401)
    access, refresh = make_tokens(uid, user_type)
    return success({"token": access, "refresh_token": refresh}, status=200)


@auth_bp.post("/asha/reset-pin")
@require_admin
def asha_reset_pin():
    data = request.get_json(silent=True) or {}
    worker_id = str(data.get("worker_id", "")).strip().lower()
    new_pin = str(data.get("new_pin", "")).strip()
    if not worker_id or not new_pin:
        return error("validation_error", "worker_id and new_pin required", status=400)

    worker = AshaWorker.query.filter(db.func.lower(AshaWorker.worker_id) == worker_id).first()
    if not worker:
        return error("not_found", "ASHA worker not found", status=404)

    worker.pin_hash = bcrypt.hashpw(new_pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.session.commit()
    return success({"message": "PIN updated"}, status=200)
