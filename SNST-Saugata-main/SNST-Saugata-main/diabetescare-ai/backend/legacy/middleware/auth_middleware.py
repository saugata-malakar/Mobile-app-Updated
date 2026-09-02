from datetime import datetime, timezone
from functools import wraps

from flask import g, request
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException

from models import Admin, AshaWorker, AuditLog, Doctor, Patient, db
from utils.response_helper import error


def _audit(user_id: str, user_type: str, action: str, resource_type: str | None = None):
    log = AuditLog(
        user_id=user_id,
        user_type=user_type,
        action=action,
        resource_type=resource_type,
        resource_id=None,
        ip_address=request.remote_addr,
        status_code=200,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(log)
    db.session.commit()


def _load_user(user_type: str, user_id: str):
    if user_type == "patient":
        return Patient.query.get(user_id)
    if user_type == "asha_worker":
        return AshaWorker.query.get(user_id)
    if user_type == "doctor":
        return Doctor.query.get(user_id)
    if user_type == "admin":
        return Admin.query.get(user_id)
    return None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return error("unauthorized", "Missing bearer token", status=401)

        try:
            verify_jwt_in_request()
        except JWTExtendedException:
            return error("unauthorized", "Invalid or expired token", status=401)

        user_id = get_jwt_identity()
        claims = get_jwt()
        user_type = claims.get("user_type")
        if not user_id or not user_type:
            return error("unauthorized", "Invalid token claims", status=401)

        user = _load_user(user_type, str(user_id))
        if user is None:
            return error("unauthorized", "User not found", status=401)

        if hasattr(user, "active") and user.active is False:
            return error("forbidden", "Inactive user", status=403)

        g.current_user = user
        g.user_type = user_type
        try:
            _audit(str(user_id), user_type, f"auth:{request.endpoint}", resource_type="api_access")
        except Exception:
            db.session.rollback()

        return fn(*args, **kwargs)

    return wrapper


def require_asha(fn):
    @wraps(fn)
    def inner(*args, **kwargs):
        if getattr(g, "user_type", None) != "asha_worker":
            return error("forbidden", "ASHA worker access only", status=403)
        return fn(*args, **kwargs)

    return require_auth(inner)


def require_doctor(fn):
    @wraps(fn)
    def inner(*args, **kwargs):
        if getattr(g, "user_type", None) != "doctor":
            return error("forbidden", "Doctor access only", status=403)
        return fn(*args, **kwargs)

    return require_auth(inner)


def require_admin(fn):
    @wraps(fn)
    def inner(*args, **kwargs):
        if getattr(g, "user_type", None) != "admin":
            return error("forbidden", "Admin access only", status=403)
        return fn(*args, **kwargs)

    return require_auth(inner)
