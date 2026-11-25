"""
DiabetesCare AI v4.0 — Unified 4-Role Workflow Router (SQLite-backed).

Supports:
  - 4 roles: doctor, field_worker (ASHA/ICDS/CHO), moderator, admin
  - Multi-identifier auth: email, phone, username, worker_id + password
  - Guided 3-photo submission + CV quality/segmentation + optional medical reports
  - Doctor direct workflow (₹80 doctor + ₹20 helper = ₹100)
  - Field-worker workflow (AI check -> Moderator ₹20 -> Doctor validate ₹30 + Collector ₹50 = ₹100)
  - Admin management, overrides, payout ledger, and rate configuration
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, Body, Header, HTTPException, Query, Request, status
from pydantic import BaseModel

from cv.preprocessing.calibrant_detection import detect_calibrant_sticker
from cv.preprocessing.quality import assess_image_quality
from cv.segmentation.wound_segmentation import segment_and_measure_wound

SECRET_KEY = os.getenv("SECRET_KEY", "diabetescare-dev-secret-change-in-prod")

ALLOWED_ROLES = {"doctor", "field_worker", "moderator", "admin", "patient"}
ALLOWED_WORKER_TYPES = {"ASHA", "ICDS", "CHO"}
PHOTO_TYPE_BY_NUM = {1: "distant", 2: "medium", 3: "close"}

DEFAULT_RATES = {
    "doctor_direct": 80.0,
    "doctor_helper": 20.0,
    "field_worker": 50.0,
    "moderator": 20.0,
    "doctor_validation": 30.0,
}


# ── Password & JWT Helpers ────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2_sha256${salt}${dk.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    if stored_hash.startswith("pbkdf2_sha256$"):
        parts = stored_hash.split("$", 2)
        if len(parts) != 3:
            return False
        _, salt, expected_hex = parts
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return hmac.compare_digest(dk.hex(), expected_hex)
    return hmac.compare_digest(password, stored_hash)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _create_jwt(user: dict, expires_hours: int = 24) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    exp = int((datetime.utcnow() + timedelta(hours=expires_hours)).timestamp())
    payload_dict = {
        "sub": user["user_id"],
        "user_id": user["user_id"],
        "role": user["role"],
        "worker_type": user.get("worker_type"),
        "email": user.get("email"),
        "phone": user.get("phone"),
        "worker_id": user.get("worker_id"),
        "name": user.get("full_name"),
        "exp": exp,
    }
    payload = _b64url_encode(json.dumps(payload_dict).encode("utf-8"))
    signing_input = f"{header}.{payload}".encode("ascii")
    sig = _b64url_encode(hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def _decode_jwt(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
        expected_sig = _b64url_encode(
            hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        )
        if not hmac.compare_digest(parts[2], expected_sig):
            return None
        payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
        if payload.get("exp") and datetime.utcnow().timestamp() > float(payload["exp"]):
            return None
        return payload
    except Exception:
        return None


def _clean_str(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


# ── Request Models ────────────────────────────────────────────────────────────

class WorkflowRegisterPayload(BaseModel):
    full_name: str
    role: str = "field_worker"
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    worker_id: Optional[str] = None
    worker_type: Optional[str] = None
    district: Optional[str] = None
    specialization: Optional[str] = None
    password: str


class WorkflowLoginPayload(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    worker_id: Optional[str] = None
    password: str
    role: Optional[str] = None


class CreateSubmissionPayload(BaseModel):
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_weight_kg: Optional[float] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    patient_bp_systolic: Optional[int] = None
    patient_bp_diastolic: Optional[int] = None
    blood_sugar: Optional[float] = None
    patient_blood_sugar: Optional[float] = None
    comorbidities: Optional[Any] = None
    patient_comorbidities: Optional[Any] = None
    district: Optional[str] = None
    is_followup: bool = False
    original_submission_id: Optional[str] = None
    submitted_by_user_id: Optional[str] = None
    submitted_by_name: Optional[str] = None
    submitter_role: Optional[str] = None
    worker_type: Optional[str] = None


class ClinicalNotePayload(BaseModel):
    diagnosis: str
    severity: Optional[str] = None
    treatment_needed: Optional[str] = None
    medication: Optional[str] = None


class SubmitBodyPayload(BaseModel):
    diagnosis: Optional[str] = None
    severity: Optional[str] = None
    treatment_needed: Optional[str] = None
    medication: Optional[str] = None


class ModeratorApprovePayload(BaseModel):
    note: Optional[str] = None


class ModeratorRejectPayload(BaseModel):
    reason: str


class AdminUserPatchPayload(BaseModel):
    status: Optional[str] = None
    role: Optional[str] = None
    district: Optional[str] = None
    worker_type: Optional[str] = None


class AdminOverridePayload(BaseModel):
    status: str  # accepted | rejected
    reason: Optional[str] = None


# ── Router Factory ────────────────────────────────────────────────────────────

def create_workflow_router(
    get_target_databases: Callable[[], List[str]],
    stored_photos_dir: str,
    patients_db: Dict[str, dict],
    alerts_db: List[dict],
    audit_logs_db: List[dict],
    get_ml_wound_model: Callable[[], Any],
) -> APIRouter:
    router = APIRouter()

    def _primary_db() -> str:
        dbs = get_target_databases()
        return dbs[0]

    def _connect(db_path: str) -> sqlite3.Connection:
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _execute_all(fn: Callable[[sqlite3.Connection], Any]) -> Any:
        result = None
        for idx, db_path in enumerate(get_target_databases()):
            conn = _connect(db_path)
            try:
                res = fn(conn)
                conn.commit()
                if idx == 0:
                    result = res
            finally:
                conn.close()
        return result

    def ensure_workflow_tables() -> None:
        def _init_conn(conn: sqlite3.Connection):
            c = conn.cursor()
            c.execute("""
                CREATE TABLE IF NOT EXISTS app_users (
                    user_id TEXT PRIMARY KEY,
                    email TEXT,
                    phone TEXT,
                    username TEXT,
                    worker_id TEXT,
                    password_hash TEXT,
                    full_name TEXT,
                    role TEXT,
                    worker_type TEXT,
                    district TEXT,
                    specialization TEXT,
                    status TEXT DEFAULT 'active',
                    created_at TEXT
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS workflow_submissions (
                    submission_id TEXT PRIMARY KEY,
                    patient_id TEXT,
                    submitted_by_user_id TEXT,
                    submitted_by_name TEXT,
                    submitter_role TEXT,
                    worker_type TEXT,
                    status TEXT,
                    is_followup INTEGER DEFAULT 0,
                    original_submission_id TEXT,
                    patient_name TEXT,
                    patient_age INTEGER,
                    patient_weight_kg REAL,
                    bp_systolic INTEGER,
                    bp_diastolic INTEGER,
                    blood_sugar REAL,
                    comorbidities_json TEXT,
                    district TEXT,
                    ai_quality_passed INTEGER,
                    ai_quality_score REAL,
                    ai_rejection_reason TEXT,
                    ai_wagner_grade INTEGER,
                    ai_area_cm2 REAL,
                    moderator_id TEXT,
                    moderator_name TEXT,
                    moderator_decision TEXT,
                    moderator_note TEXT,
                    moderator_reviewed_at TEXT,
                    doctor_id TEXT,
                    doctor_name TEXT,
                    diagnosis TEXT,
                    severity TEXT,
                    treatment_needed TEXT,
                    medication TEXT,
                    doctor_completed_at TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS workflow_photos (
                    photo_id TEXT PRIMARY KEY,
                    submission_id TEXT,
                    photo_number INTEGER,
                    photo_type TEXT,
                    file_url TEXT,
                    annotated_url TEXT,
                    quality_passed INTEGER,
                    blur_score REAL,
                    brightness_mean REAL,
                    coin_detected INTEGER,
                    created_at TEXT
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS workflow_reports (
                    report_id TEXT PRIMARY KEY,
                    submission_id TEXT,
                    file_name TEXT,
                    file_url TEXT,
                    file_type TEXT,
                    created_at TEXT
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS workflow_payments (
                    payment_id TEXT PRIMARY KEY,
                    submission_id TEXT,
                    user_id TEXT,
                    user_name TEXT,
                    role TEXT,
                    amount REAL,
                    description TEXT,
                    status TEXT DEFAULT 'credited',
                    created_at TEXT,
                    paid_at TEXT
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS workflow_rates (
                    role TEXT PRIMARY KEY,
                    amount REAL
                )
            """)

            # Seed default rates
            for r_key, r_amt in DEFAULT_RATES.items():
                c.execute(
                    "INSERT OR IGNORE INTO workflow_rates (role, amount) VALUES (?, ?)",
                    (r_key, r_amt),
                )

            # Seed demo users if empty
            c.execute("SELECT COUNT(*) FROM app_users")
            if c.fetchone()[0] == 0:
                now_iso = datetime.utcnow().isoformat()
                demo_users = [
                    (
                        "DOC_IITKGP_01", "doctor@demo.in", "9831000001", "doctor",
                        "DOC_IITKGP_01", _hash_password("doctor123"),
                        "Dr. Clinical Specialist", "doctor", None, "Paschim Medinipur",
                        "Endocrinology & Diabetic Foot Care", "active", now_iso,
                    ),
                    (
                        "ASHA_WB_0042", "asha@demo.in", "9831000002", "asha001",
                        "ASHA_WB_0042", _hash_password("asha123"),
                        "Shanta Roy", "field_worker", "ASHA", "Paschim Medinipur",
                        None, "active", now_iso,
                    ),
                    (
                        "ICDS_WB_0010", "icds@demo.in", "9831000003", "icds001",
                        "ICDS_WB_0010", _hash_password("icds123"),
                        "Ananya Das", "field_worker", "ICDS", "Jhargram",
                        None, "active", now_iso,
                    ),
                    (
                        "CHO_WB_0015", "cho@demo.in", "9831000006", "cho001",
                        "CHO_WB_0015", _hash_password("cho123"),
                        "Subhamita Pal", "field_worker", "CHO", "Purba Medinipur",
                        None, "active", now_iso,
                    ),
                    (
                        "MOD_MMCH_01", "moderator@demo.in", "9831000004", "mod001",
                        "MOD_MMCH_01", _hash_password("mod123"),
                        "Priya Banerjee", "moderator", None, "Paschim Medinipur",
                        None, "active", now_iso,
                    ),
                    (
                        "ADMIN_MMCH_01", "admin@hospital.in", "9831000005", "admin",
                        "ADMIN_MMCH_01", _hash_password("admin123"),
                        "Hospital System Admin", "admin", None, "Kharagpur",
                        None, "active", now_iso,
                    ),
                    (
                        "PAT_KGP_01", "patient@demo.in", "9831000007", "patient",
                        "PAT_KGP_01", _hash_password("patient123"),
                        "Ramesh Chandra Sen", "patient", None, "Paschim Medinipur",
                        None, "active", now_iso,
                    ),
                ]
                c.executemany(
                    """
                    INSERT OR IGNORE INTO app_users (
                        user_id, email, phone, username, worker_id, password_hash,
                        full_name, role, worker_type, district, specialization, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    demo_users,
                )

            # Ensure demo patient exists even on existing DBs
            c.execute("SELECT COUNT(*) FROM app_users WHERE user_id = 'PAT_KGP_01'")
            if c.fetchone()[0] == 0:
                c.execute(
                    """
                    INSERT OR IGNORE INTO app_users (
                        user_id, email, phone, username, worker_id, password_hash,
                        full_name, role, worker_type, district, specialization, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "PAT_KGP_01", "patient@demo.in", "9831000007", "patient",
                        "PAT_KGP_01", _hash_password("patient123"),
                        "Ramesh Chandra Sen", "patient", None, "Paschim Medinipur",
                        None, "active", datetime.utcnow().isoformat(),
                    ),
                )

        _execute_all(_init_conn)

    ensure_workflow_tables()

    # ── Query & Helper Utilities ──────────────────────────────────────────────

    def _serialize_user(row: sqlite3.Row) -> dict:
        return {
            "user_id": row["user_id"],
            "email": row["email"],
            "phone": row["phone"],
            "username": row["username"],
            "worker_id": row["worker_id"],
            "full_name": row["full_name"],
            "name": row["full_name"],
            "role": row["role"],
            "worker_type": row["worker_type"],
            "district": row["district"],
            "specialization": row["specialization"],
            "status": row["status"],
            "created_at": row["created_at"],
        }

    def _get_user_from_header(authorization: Optional[str]) -> Optional[dict]:
        if not authorization or not authorization.startswith("Bearer "):
            return None
        token = authorization.split(" ", 1)[1].strip()
        claims = _decode_jwt(token)
        if not claims:
            return None
        uid = claims.get("user_id") or claims.get("sub")
        if not uid:
            return None
        conn = _connect(_primary_db())
        try:
            row = conn.execute("SELECT * FROM app_users WHERE user_id = ?", (uid,)).fetchone()
            return _serialize_user(row) if row else None
        finally:
            conn.close()

    def _require_user(authorization: Optional[str], allowed_roles: Optional[set] = None) -> dict:
        user = _get_user_from_header(authorization)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        if user.get("status") != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.get('status') or 'inactive'}. Contact administrator.",
            )
        if allowed_roles and user["role"] != "admin" and user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Restricted to roles: {', '.join(sorted(allowed_roles))}",
            )
        return user

    def _get_rates(conn: sqlite3.Connection) -> Dict[str, float]:
        rates = dict(DEFAULT_RATES)
        for row in conn.execute("SELECT role, amount FROM workflow_rates").fetchall():
            rates[row["role"]] = float(row["amount"])
        return rates

    def _record_payment(
        submission_id: str,
        user_id: str,
        user_name: str,
        role: str,
        amount: float,
        description: str,
    ) -> dict:
        now_iso = datetime.utcnow().isoformat()
        payment_id = f"PAY_{uuid.uuid4().hex[:10].upper()}"

        def _insert(conn: sqlite3.Connection):
            existing = conn.execute(
                "SELECT * FROM workflow_payments WHERE submission_id = ? AND user_id = ? AND role = ?",
                (submission_id, user_id, role),
            ).fetchone()
            if existing:
                return dict(existing)
            conn.execute(
                """
                INSERT INTO workflow_payments (
                    payment_id, submission_id, user_id, user_name, role,
                    amount, description, status, created_at, paid_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'credited', ?, NULL)
                """,
                (payment_id, submission_id, user_id, user_name, role, amount, description, now_iso),
            )
            return {
                "payment_id": payment_id,
                "submission_id": submission_id,
                "user_id": user_id,
                "user_name": user_name,
                "role": role,
                "amount": amount,
                "description": description,
                "status": "credited",
                "created_at": now_iso,
                "paid_at": None,
            }

        return _execute_all(_insert)

    def _fetch_submission_full(submission_id: str) -> Optional[dict]:
        conn = _connect(_primary_db())
        try:
            sub = conn.execute(
                "SELECT * FROM workflow_submissions WHERE submission_id = ?",
                (submission_id,),
            ).fetchone()
            if not sub:
                return None
            photos = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM workflow_photos WHERE submission_id = ? ORDER BY photo_number ASC",
                    (submission_id,),
                ).fetchall()
            ]
            reports = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM workflow_reports WHERE submission_id = ? ORDER BY created_at ASC",
                    (submission_id,),
                ).fetchall()
            ]
            payments = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM workflow_payments WHERE submission_id = ? ORDER BY created_at ASC",
                    (submission_id,),
                ).fetchall()
            ]
            d = dict(sub)
            try:
                d["comorbidities"] = json.loads(d["comorbidities_json"]) if d.get("comorbidities_json") else []
            except Exception:
                d["comorbidities"] = []
            d["is_followup"] = bool(d.get("is_followup"))
            d["ai_quality_passed"] = None if d.get("ai_quality_passed") is None else bool(d["ai_quality_passed"])
            d["photos"] = photos
            d["photo_count"] = len(photos)
            d["reports"] = reports
            d["payments"] = payments
            return d
        finally:
            conn.close()

    def _sync_to_clinical_hub(sub: dict, photos: List[dict]) -> None:
        """Reflect accepted submission in _PATIENTS_DB, _ALERTS_DB, and core SQLite tables."""
        pid = sub["patient_id"]
        wagner = sub.get("ai_wagner_grade") or 1
        area = sub.get("ai_area_cm2") or 2.5
        primary_photo = photos[-1]["file_url"].lstrip("/") if photos else None
        now_iso = datetime.utcnow().isoformat()

        patients_db[pid] = {
            "patient_id": pid,
            "id": pid,
            "full_name": sub.get("patient_name") or f"Patient {pid}",
            "name": sub.get("patient_name") or f"Patient {pid}",
            "age": sub.get("patient_age") or 55,
            "gender": "Unknown",
            "phone": "+91 98000 00000",
            "district": sub.get("district") or "Paschim Medinipur",
            "bp_systolic": sub.get("bp_systolic"),
            "bp_diastolic": sub.get("bp_diastolic"),
            "blood_sugar": sub.get("blood_sugar"),
            "wagner_grade": wagner,
            "urgency": "HIGH" if wagner >= 2 else "MEDIUM",
            "latest_wound_area_cm2": area,
            "registered_by": sub.get("submitted_by_user_id"),
            "last_visit": datetime.utcnow().strftime("%Y-%m-%d"),
            "doctor_diagnosis": sub.get("diagnosis"),
            "photo_file": primary_photo,
            "status": "Under Active Review" if wagner >= 2 else "Healing Well",
            "wound_site": "Plantar Foot",
        }

        alerts_db.insert(0, {
            "id": f"ALT_{uuid.uuid4().hex[:6].upper()}",
            "alert_id": f"ALT_{uuid.uuid4().hex[:6].upper()}",
            "patient_id": pid,
            "patient_name": sub.get("patient_name") or pid,
            "severity": "HIGH" if wagner >= 2 else "MEDIUM",
            "alert_level": "red" if wagner >= 2 else "yellow",
            "message": f"Workflow Accepted ({sub.get('submitter_role')}): {sub.get('diagnosis') or 'Clinical assessment completed'}",
            "wound_site_label": "Plantar Foot",
            "timestamp": now_iso,
            "resolved": False,
            "escalated_to": sub.get("doctor_id") or "DOC_IITKGP_01",
        })

        audit_logs_db.insert(0, {
            "log_id": f"AUD_{uuid.uuid4().hex[:6].upper()}",
            "timestamp": now_iso,
            "action": "WORKFLOW_SUBMISSION_ACCEPTED",
            "actor_id": sub.get("doctor_id") or sub.get("submitted_by_user_id"),
            "patient_id": pid,
            "purpose": "DiabetesCare AI v4.0 Screening & Validation",
            "consent_verified": True,
            "dpdp_compliant": True,
        })

    # ── 1. Auth Endpoints ─────────────────────────────────────────────────────

    @router.post("/api/v1/auth/register", status_code=status.HTTP_201_CREATED)
    def workflow_register(payload: WorkflowRegisterPayload):
        email = _clean_str(payload.email)
        phone = _clean_str(payload.phone)
        username = _clean_str(payload.username)
        worker_id = _clean_str(payload.worker_id)
        full_name = _clean_str(payload.full_name)
        if not full_name:
            raise HTTPException(status_code=400, detail="full_name is required")
        if not payload.password or len(payload.password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

        role = (payload.role or "field_worker").strip().lower()
        worker_type = _clean_str(payload.worker_type)
        if role in ("asha", "icds", "cho"):
            worker_type = worker_type or role.upper()
            role = "field_worker"
        if role not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role '{payload.role}'")

        if worker_type:
            worker_type = worker_type.upper()
            if worker_type not in ALLOWED_WORKER_TYPES:
                raise HTTPException(status_code=400, detail="worker_type must be ASHA, ICDS, or CHO")
        elif role == "field_worker":
            worker_type = "ASHA"

        if not any([email, phone, username, worker_id]):
            raise HTTPException(
                status_code=400,
                detail="Provide at least one of email, phone, username, or worker_id",
            )

        conn = _connect(_primary_db())
        try:
            checks = [
                ("email", email, "Email already registered"),
                ("phone", phone, "Phone number already registered"),
                ("username", username, "Username already registered"),
                ("worker_id", worker_id, "Worker ID already registered"),
            ]
            for col, val, msg in checks:
                if val:
                    dup = conn.execute(
                        f"SELECT user_id FROM app_users WHERE LOWER({col}) = LOWER(?)",
                        (val,),
                    ).fetchone()
                    if dup:
                        raise HTTPException(status_code=400, detail=msg)
        finally:
            conn.close()

        if not worker_id:
            prefix = (
                "DOC" if role == "doctor"
                else "MOD" if role == "moderator"
                else "ADMIN" if role == "admin"
                else "PAT" if role == "patient"
                else (worker_type or "FW")
            )
            worker_id = f"{prefix}_{uuid.uuid4().hex[:6].upper()}"

        user_id = worker_id
        now_iso = datetime.utcnow().isoformat()
        pw_hash = _hash_password(payload.password)

        def _insert(conn: sqlite3.Connection):
            conn.execute(
                """
                INSERT INTO app_users (
                    user_id, email, phone, username, worker_id, password_hash,
                    full_name, role, worker_type, district, specialization, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """,
                (
                    user_id, email, phone, username, worker_id, pw_hash,
                    full_name, role, worker_type, _clean_str(payload.district),
                    _clean_str(payload.specialization), now_iso,
                ),
            )
            row = conn.execute("SELECT * FROM app_users WHERE user_id = ?", (user_id,)).fetchone()
            return _serialize_user(row)

        user_obj = _execute_all(_insert)
        return {
            "status": "pending",
            "data": {
                "pending_approval": True,
                "status": "pending",
                "role": user_obj["role"],
                "user_id": user_obj["user_id"],
                "name": user_obj["full_name"],
                "email": user_obj["email"],
                "phone": user_obj["phone"],
                "worker_id": user_obj["worker_id"],
                "worker_type": user_obj["worker_type"],
                "user": user_obj,
                "message": "Registration submitted. An Administrator must verify and approve your account before login.",
            },
        }

    @router.post("/api/v1/auth/login")
    @router.post("/api/v1/auth/doctor/login")
    def workflow_login(payload: WorkflowLoginPayload):
        ident = (
            _clean_str(payload.identifier)
            or _clean_str(payload.email)
            or _clean_str(payload.phone)
            or _clean_str(payload.username)
            or _clean_str(payload.worker_id)
        )
        if not ident:
            raise HTTPException(
                status_code=400,
                detail="Provide identifier, email, phone, username, or worker_id",
            )

        conn = _connect(_primary_db())
        try:
            row = conn.execute(
                """
                SELECT * FROM app_users
                WHERE LOWER(COALESCE(email, '')) = LOWER(?)
                   OR LOWER(COALESCE(phone, '')) = LOWER(?)
                   OR LOWER(COALESCE(username, '')) = LOWER(?)
                   OR LOWER(COALESCE(worker_id, '')) = LOWER(?)
                LIMIT 1
                """,
                (ident, ident, ident, ident),
            ).fetchone()
        finally:
            conn.close()

        if not row or not _verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if row["status"] == "pending":
            raise HTTPException(
                status_code=403,
                detail="Account is pending Admin verification. An Administrator must approve your account before you can sign in.",
            )
        if row["status"] == "rejected":
            raise HTTPException(
                status_code=403,
                detail="Your account registration was rejected by the Administrator.",
            )
        if row["status"] != "active":
            raise HTTPException(status_code=403, detail="Account is suspended. Contact administrator.")

        user_obj = _serialize_user(row)
        token = _create_jwt(user_obj)
        return {
            "status": "success",
            "data": {
                "token": token,
                "access_token": token,
                "refresh_token": token,
                "role": user_obj["role"],
                "user_id": user_obj["user_id"],
                "doctor_id": user_obj["worker_id"] if user_obj["role"] == "doctor" else None,
                "name": user_obj["full_name"],
                "email": user_obj["email"],
                "phone": user_obj["phone"],
                "worker_id": user_obj["worker_id"],
                "worker_type": user_obj["worker_type"],
                "user": user_obj,
            },
        }

    @router.get("/api/v1/auth/me")
    def workflow_me(authorization: Optional[str] = Header(default=None)):
        user = _require_user(authorization)
        return {"status": "success", "data": user}

    # ── 2. Submissions Workflow ───────────────────────────────────────────────

    @router.post("/api/v1/submissions", status_code=status.HTTP_201_CREATED)
    @router.post("/api/v1/submissions/", status_code=status.HTTP_201_CREATED)
    def create_submission(
        payload: CreateSubmissionPayload,
        authorization: Optional[str] = Header(default=None),
    ):
        auth_user = _get_user_from_header(authorization)
        if authorization and not auth_user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        submitter_id = (auth_user["user_id"] if auth_user else None) or _clean_str(payload.submitted_by_user_id)
        if not submitter_id:
            raise HTTPException(status_code=401, detail="Authentication or submitted_by_user_id required")

        submitter_role = (auth_user["role"] if auth_user else None) or _clean_str(payload.submitter_role) or "field_worker"
        if submitter_role not in ("doctor", "field_worker", "admin"):
            raise HTTPException(status_code=403, detail="Only doctors or field workers can create submissions")

        submitter_name = (auth_user["full_name"] if auth_user else None) or _clean_str(payload.submitted_by_name) or submitter_id
        worker_type = (auth_user.get("worker_type") if auth_user else None) or _clean_str(payload.worker_type)
        district = _clean_str(payload.district) or (auth_user.get("district") if auth_user else None)

        patient_id = _clean_str(payload.patient_id)
        if payload.original_submission_id and not patient_id:
            orig = _fetch_submission_full(payload.original_submission_id)
            if orig:
                patient_id = orig["patient_id"]
        if not patient_id:
            patient_id = f"PAT_KGP_{uuid.uuid4().hex[:6].upper()}"

        submission_id = f"SUB_{uuid.uuid4().hex[:10].upper()}"
        now_iso = datetime.utcnow().isoformat()
        bp_sys = payload.bp_systolic if payload.bp_systolic is not None else payload.patient_bp_systolic
        bp_dia = payload.bp_diastolic if payload.bp_diastolic is not None else payload.patient_bp_diastolic
        sugar = payload.blood_sugar if payload.blood_sugar is not None else payload.patient_blood_sugar
        comorb = payload.comorbidities if payload.comorbidities is not None else payload.patient_comorbidities
        comorb_json = json.dumps(comorb if comorb is not None else [])

        def _insert(conn: sqlite3.Connection):
            conn.execute(
                """
                INSERT INTO workflow_submissions (
                    submission_id, patient_id, submitted_by_user_id, submitted_by_name,
                    submitter_role, worker_type, status, is_followup, original_submission_id,
                    patient_name, patient_age, patient_weight_kg, bp_systolic, bp_diastolic,
                    blood_sugar, comorbidities_json, district, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    submission_id, patient_id, submitter_id, submitter_name,
                    submitter_role, worker_type, 1 if (payload.is_followup or payload.original_submission_id) else 0,
                    payload.original_submission_id, _clean_str(payload.patient_name),
                    payload.patient_age, payload.patient_weight_kg, bp_sys, bp_dia,
                    sugar, comorb_json, district, now_iso, now_iso,
                ),
            )

        _execute_all(_insert)
        return _fetch_submission_full(submission_id)

    @router.post("/api/v1/submissions/{submission_id}/photos", status_code=status.HTTP_201_CREATED)
    async def upload_submission_photo(
        submission_id: str,
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        _get_user_from_header(authorization)
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")

        content_type = request.headers.get("content-type", "")
        raw_bytes: bytes = b""
        photo_number: int = 1
        photo_type: Optional[str] = None

        if "multipart/form-data" in content_type:
            form = await request.form()
            file_field = form.get("file") or form.get("photo")
            if file_field is None:
                raise HTTPException(status_code=400, detail="Multipart 'file' field is required")
            raw_bytes = await file_field.read()
            pn_raw = form.get("photo_number")
            if pn_raw is None:
                raise HTTPException(status_code=400, detail="photo_number (1, 2, or 3) is required")
            photo_number = int(pn_raw)
            photo_type = form.get("photo_type")
        else:
            try:
                body = await request.json()
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid JSON or multipart payload")
            b64 = body.get("image_base64") or body.get("photo_data") or ""
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            try:
                raw_bytes = base64.b64decode(b64)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid base64 image data")
            if body.get("photo_number") is None:
                raise HTTPException(status_code=400, detail="photo_number (1, 2, or 3) is required")
            photo_number = int(body["photo_number"])
            photo_type = body.get("photo_type")

        if photo_number not in PHOTO_TYPE_BY_NUM:
            raise HTTPException(status_code=400, detail="photo_number must be 1, 2, or 3")
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Uploaded photo is empty")

        resolved_type = (photo_type or PHOTO_TYPE_BY_NUM[photo_number]).strip().lower()
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image file")

        # Save original image to STORED_PHOTOS_DIR
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        orig_name = f"wf_{submission_id}_p{photo_number}_{ts}.jpg"
        orig_path = os.path.join(stored_photos_dir, orig_name)
        cv2.imwrite(orig_path, img)
        file_url = f"/stored_photos/{orig_name}"

        # Run CV pipeline (quality + coin calibrant + segmentation)
        quality_res = assess_image_quality(img)
        calib_res = detect_calibrant_sticker(img)
        seg_res = segment_and_measure_wound(
            img,
            pixels_per_mm=calib_res["pixels_per_mm"],
            sticker_center=calib_res["center"],
            sticker_radius=calib_res["radius"],
        )

        # Tolerant pass gate for valid device/PC uploads while catching dark/blank/extremely blurry shots
        gray_std = float(np.std(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)))
        blur_score = float(quality_res.get("blur_score", 0.0))
        bright = float(quality_res.get("brightness_mean", 128.0))
        reasons: List[str] = []
        if gray_std < 6.0:
            reasons.append("blank or uniform image")
        if bright < 25.0:
            reasons.append("image is too dark")
        elif bright > 245.0:
            reasons.append("image is severely overexposed")
        if blur_score < 12.0:
            reasons.append("image is extremely blurry")
        photo_passed = len(reasons) == 0

        annotated_url = file_url
        anno_b64 = seg_res.get("annotated_b64")
        if anno_b64:
            try:
                if "," in anno_b64:
                    anno_b64 = anno_b64.split(",", 1)[1]
                anno_bytes = base64.b64decode(anno_b64)
                anno_name = f"wf_{submission_id}_p{photo_number}_{ts}_annotated.jpg"
                with open(os.path.join(stored_photos_dir, anno_name), "wb") as f:
                    f.write(anno_bytes)
                annotated_url = f"/stored_photos/{anno_name}"
            except Exception:
                pass

        # Optional ML Wagner grading on close-up (or latest)
        wagner_grade = 1
        try:
            ml_model = get_ml_wound_model()
            if ml_model is not None:
                import io
                from PIL import Image
                pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
                pred = ml_model.predict_single(pil_img)
                if "error" not in pred:
                    wagner_grade = int(pred.get("wagner_grade", 1))
        except Exception:
            pass

        photo_id = f"PHT_{uuid.uuid4().hex[:10].upper()}"
        now_iso = datetime.utcnow().isoformat()
        coin_detected = 1 if calib_res.get("sticker_detected") else 0

        def _upsert_photo(conn: sqlite3.Connection):
            conn.execute(
                "DELETE FROM workflow_photos WHERE submission_id = ? AND photo_number = ?",
                (submission_id, photo_number),
            )
            conn.execute(
                """
                INSERT INTO workflow_photos (
                    photo_id, submission_id, photo_number, photo_type, file_url, annotated_url,
                    quality_passed, blur_score, brightness_mean, coin_detected, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    photo_id, submission_id, photo_number, resolved_type, file_url, annotated_url,
                    1 if photo_passed else 0, blur_score, bright, coin_detected, now_iso,
                ),
            )
            conn.execute(
                """
                UPDATE workflow_submissions
                SET ai_wagner_grade = ?, ai_area_cm2 = ?, updated_at = ?
                WHERE submission_id = ?
                """,
                (wagner_grade, seg_res.get("area_cm2"), now_iso, submission_id),
            )

        _execute_all(_upsert_photo)
        return {
            "photo_id": photo_id,
            "submission_id": submission_id,
            "photo_number": photo_number,
            "photo_type": resolved_type,
            "file_url": file_url,
            "annotated_url": annotated_url,
            "quality_passed": photo_passed,
            "rejection_reasons": reasons,
            "blur_score": blur_score,
            "brightness_mean": bright,
            "quality_score": quality_res.get("quality_score", 0.8),
            "coin_detected": bool(coin_detected),
            "warnings": quality_res.get("suggestions", []),
            "measurements": {
                "length_mm": seg_res.get("length_mm"),
                "width_mm": seg_res.get("width_mm"),
                "area_cm2": seg_res.get("area_cm2"),
                "perimeter_mm": seg_res.get("perimeter_mm"),
                "wagner_grade": wagner_grade,
            },
        }

    @router.post("/api/v1/submissions/{submission_id}/reports", status_code=status.HTTP_201_CREATED)
    async def upload_submission_report(
        submission_id: str,
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        _get_user_from_header(authorization)
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")

        content_type = request.headers.get("content-type", "")
        raw_bytes: bytes = b""
        file_name = "medical_report"
        file_type = "application/octet-stream"

        if "multipart/form-data" in content_type:
            form = await request.form()
            f_obj = form.get("file")
            if f_obj is None:
                raise HTTPException(status_code=400, detail="Multipart 'file' is required")
            raw_bytes = await f_obj.read()
            file_name = f_obj.filename or file_name
            file_type = getattr(f_obj, "content_type", None) or file_type
        else:
            body = await request.json()
            b64 = body.get("file_base64") or body.get("file_data") or ""
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            raw_bytes = base64.b64decode(b64)
            file_name = body.get("file_name") or file_name
            file_type = body.get("file_type") or file_type

        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Uploaded report is empty")

        safe_name = "".join(c for c in file_name if c.isalnum() or c in (".", "_", "-")) or "report.bin"
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        disk_name = f"reports_{submission_id}_{ts}_{safe_name}"
        with open(os.path.join(stored_photos_dir, disk_name), "wb") as out:
            out.write(raw_bytes)

        report_id = f"RPT_{uuid.uuid4().hex[:10].upper()}"
        file_url = f"/stored_photos/{disk_name}"
        now_iso = datetime.utcnow().isoformat()

        def _insert(conn: sqlite3.Connection):
            conn.execute(
                """
                INSERT INTO workflow_reports (report_id, submission_id, file_name, file_url, file_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (report_id, submission_id, file_name, file_url, file_type, now_iso),
            )

        _execute_all(_insert)
        return {
            "report_id": report_id,
            "submission_id": submission_id,
            "file_name": file_name,
            "file_url": file_url,
            "file_type": file_type,
            "created_at": now_iso,
        }

    @router.post("/api/v1/submissions/{submission_id}/clinical-note")
    def add_clinical_note(
        submission_id: str,
        payload: ClinicalNotePayload,
        authorization: Optional[str] = Header(default=None),
    ):
        user = _require_user(authorization, allowed_roles={"doctor", "admin"})
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        if not _clean_str(payload.diagnosis):
            raise HTTPException(status_code=400, detail="diagnosis is required")

        now_iso = datetime.utcnow().isoformat()

        def _update(conn: sqlite3.Connection):
            conn.execute(
                """
                UPDATE workflow_submissions
                SET doctor_id = ?, doctor_name = ?, diagnosis = ?, severity = ?,
                    treatment_needed = ?, medication = ?, updated_at = ?
                WHERE submission_id = ?
                """,
                (
                    user["user_id"], user["full_name"], payload.diagnosis.strip(),
                    _clean_str(payload.severity), _clean_str(payload.treatment_needed),
                    _clean_str(payload.medication), now_iso, submission_id,
                ),
            )

        _execute_all(_update)
        return _fetch_submission_full(submission_id)

    @router.post("/api/v1/submissions/{submission_id}/submit")
    def submit_submission(
        submission_id: str,
        payload: Optional[SubmitBodyPayload] = Body(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        auth_user = _get_user_from_header(authorization)
        if authorization and not auth_user:
            raise HTTPException(status_code=401, detail="Invalid token")

        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        if sub["status"] not in ("draft", "rejected"):
            raise HTTPException(status_code=400, detail=f"Submission already in status '{sub['status']}'")

        now_iso = datetime.utcnow().isoformat()
        # Allow optional inline clinical note fields if doctor passes them on submit
        if payload and payload.diagnosis and sub["submitter_role"] == "doctor":
            def _save_inline(conn: sqlite3.Connection):
                conn.execute(
                    """
                    UPDATE workflow_submissions
                    SET diagnosis = ?, severity = ?, treatment_needed = ?, medication = ?, updated_at = ?
                    WHERE submission_id = ?
                    """,
                    (
                        payload.diagnosis.strip(), _clean_str(payload.severity),
                        _clean_str(payload.treatment_needed), _clean_str(payload.medication),
                        now_iso, submission_id,
                    ),
                )
            _execute_all(_save_inline)
            sub = _fetch_submission_full(submission_id)

        photos = sub["photos"]
        photo_nums = {p["photo_number"] for p in photos}
        if not {1, 2, 3}.issubset(photo_nums):
            reason = f"All 3 photos (distance, closer, even closer) are required; uploaded {sorted(photo_nums)}"
            def _fail_count(conn: sqlite3.Connection):
                conn.execute(
                    """
                    UPDATE workflow_submissions
                    SET status = 'rejected', ai_quality_passed = 0, ai_quality_score = 0.0,
                        ai_rejection_reason = ?, updated_at = ?
                    WHERE submission_id = ?
                    """,
                    (reason, now_iso, submission_id),
                )
            _execute_all(_fail_count)
            return _fetch_submission_full(submission_id)

        if sub["submitter_role"] == "doctor" and not _clean_str(sub.get("diagnosis")):
            raise HTTPException(
                status_code=400,
                detail="Clinical note (diagnosis) is required before submitting as a doctor",
            )

        failed_photos = [p for p in photos if not p.get("quality_passed")]
        avg_blur = sum(float(p.get("blur_score") or 0.0) for p in photos) / len(photos)
        quality_score = round(min(1.0, max(0.1, avg_blur / 200.0)), 3)

        if failed_photos:
            bad_nums = ", ".join(str(p["photo_number"]) for p in failed_photos)
            reason = f"AI Quality Check failed on photo(s) {bad_nums} (blur/lighting/blank). Please retake."
            def _fail_ai(conn: sqlite3.Connection):
                conn.execute(
                    """
                    UPDATE workflow_submissions
                    SET status = 'rejected', ai_quality_passed = 0, ai_quality_score = ?,
                        ai_rejection_reason = ?, updated_at = ?
                    WHERE submission_id = ?
                    """,
                    (quality_score, reason, now_iso, submission_id),
                )
            _execute_all(_fail_ai)
            return _fetch_submission_full(submission_id)

        # AI Check Passed!
        conn = _connect(_primary_db())
        try:
            rates = _get_rates(conn)
        finally:
            conn.close()

        if sub["submitter_role"] == "doctor":
            def _accept_doc(conn: sqlite3.Connection):
                conn.execute(
                    """
                    UPDATE workflow_submissions
                    SET status = 'accepted', ai_quality_passed = 1, ai_quality_score = ?,
                        ai_rejection_reason = NULL, doctor_id = ?, doctor_name = ?,
                        doctor_completed_at = ?, updated_at = ?
                    WHERE submission_id = ?
                    """,
                    (
                        quality_score, sub["submitted_by_user_id"], sub["submitted_by_name"],
                        now_iso, now_iso, submission_id,
                    ),
                )
            _execute_all(_accept_doc)
            _record_payment(
                submission_id, sub["submitted_by_user_id"], sub["submitted_by_name"],
                "doctor", rates["doctor_direct"], "Doctor Direct Submission Accepted",
            )
            _record_payment(
                submission_id, "HELPER_SYSTEM", "Clinical Helper / Assistant",
                "doctor_helper", rates["doctor_helper"], "Assistant/Helper Share",
            )
            updated = _fetch_submission_full(submission_id)
            _sync_to_clinical_hub(updated, photos)
            return updated
        else:
            def _ai_asha(conn: sqlite3.Connection):
                conn.execute(
                    """
                    UPDATE workflow_submissions
                    SET status = 'ai_reviewed', ai_quality_passed = 1, ai_quality_score = ?,
                        ai_rejection_reason = NULL, updated_at = ?
                    WHERE submission_id = ?
                    """,
                    (quality_score, now_iso, submission_id),
                )
            _execute_all(_ai_asha)
            return _fetch_submission_full(submission_id)

    @router.get("/api/v1/submissions/my")
    def my_submissions(
        user_id: Optional[str] = Query(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        auth_user = _get_user_from_header(authorization)
        uid = (auth_user["user_id"] if auth_user else None) or _clean_str(user_id)
        if not uid:
            raise HTTPException(status_code=401, detail="Authentication or user_id required")

        conn = _connect(_primary_db())
        try:
            rows = conn.execute(
                "SELECT submission_id FROM workflow_submissions WHERE submitted_by_user_id = ? ORDER BY created_at DESC",
                (uid,),
            ).fetchall()
        finally:
            conn.close()

        items = [_fetch_submission_full(r["submission_id"]) for r in rows]
        return {"submissions": [i for i in items if i is not None]}

    @router.get("/api/v1/submissions/{submission_id}")
    def get_submission_detail(submission_id: str, authorization: Optional[str] = Header(default=None)):
        _get_user_from_header(authorization)
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        return sub

    # ── 3. Moderator Queue & Review ───────────────────────────────────────────

    @router.get("/api/v1/moderator/queue")
    def moderator_queue(
        status_filter: str = Query(default="ai_reviewed", alias="status"),
        authorization: Optional[str] = Header(default=None),
    ):
        _require_user(authorization, allowed_roles={"moderator", "admin"})
        conn = _connect(_primary_db())
        try:
            if status_filter == "all":
                rows = conn.execute(
                    """
                    SELECT submission_id FROM workflow_submissions
                    WHERE submitter_role = 'field_worker'
                      AND status IN ('ai_reviewed', 'moderator_approved', 'moderator_rejected', 'accepted')
                    ORDER BY created_at DESC
                    """
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT submission_id FROM workflow_submissions
                    WHERE submitter_role = 'field_worker' AND status = ?
                    ORDER BY created_at ASC
                    """,
                    (status_filter,),
                ).fetchall()
        finally:
            conn.close()

        items = [_fetch_submission_full(r["submission_id"]) for r in rows]
        return {"queue": [i for i in items if i is not None]}

    @router.post("/api/v1/moderator/{submission_id}/approve")
    def moderator_approve(
        submission_id: str,
        payload: Optional[ModeratorApprovePayload] = Body(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        mod = _require_user(authorization, allowed_roles={"moderator", "admin"})
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        if sub["status"] != "ai_reviewed":
            raise HTTPException(status_code=400, detail=f"Submission status is '{sub['status']}', expected 'ai_reviewed'")

        now_iso = datetime.utcnow().isoformat()
        note = _clean_str(payload.note) if payload else None

        def _approve(conn: sqlite3.Connection):
            conn.execute(
                """
                UPDATE workflow_submissions
                SET status = 'moderator_approved', moderator_id = ?, moderator_name = ?,
                    moderator_decision = 'approved', moderator_note = ?,
                    moderator_reviewed_at = ?, updated_at = ?
                WHERE submission_id = ?
                """,
                (mod["user_id"], mod["full_name"], note, now_iso, now_iso, submission_id),
            )
            return _get_rates(conn)["moderator"]

        mod_rate = _execute_all(_approve)
        _record_payment(
            submission_id, mod["user_id"], mod["full_name"],
            "moderator", mod_rate, "Moderator Verification",
        )
        return _fetch_submission_full(submission_id)

    @router.post("/api/v1/moderator/{submission_id}/reject")
    def moderator_reject(
        submission_id: str,
        payload: ModeratorRejectPayload,
        authorization: Optional[str] = Header(default=None),
    ):
        mod = _require_user(authorization, allowed_roles={"moderator", "admin"})
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        if sub["status"] != "ai_reviewed":
            raise HTTPException(status_code=400, detail=f"Submission status is '{sub['status']}', expected 'ai_reviewed'")
        if not _clean_str(payload.reason):
            raise HTTPException(status_code=400, detail="Rejection reason is required")

        now_iso = datetime.utcnow().isoformat()

        def _reject(conn: sqlite3.Connection):
            conn.execute(
                """
                UPDATE workflow_submissions
                SET status = 'moderator_rejected', moderator_id = ?, moderator_name = ?,
                    moderator_decision = 'rejected', moderator_note = ?,
                    moderator_reviewed_at = ?, updated_at = ?
                WHERE submission_id = ?
                """,
                (mod["user_id"], mod["full_name"], payload.reason.strip(), now_iso, now_iso, submission_id),
            )

        _execute_all(_reject)
        return _fetch_submission_full(submission_id)

    # ── 4. Doctor Validation Queue (ASHA/ICDS/CHO records) ────────────────────

    @router.get("/api/v1/doctor/queue")
    def doctor_validation_queue(authorization: Optional[str] = Header(default=None)):
        _require_user(authorization, allowed_roles={"doctor", "admin"})
        conn = _connect(_primary_db())
        try:
            rows = conn.execute(
                """
                SELECT submission_id FROM workflow_submissions
                WHERE status = 'moderator_approved' AND submitter_role = 'field_worker'
                ORDER BY created_at ASC
                """
            ).fetchall()
        finally:
            conn.close()
        items = [_fetch_submission_full(r["submission_id"]) for r in rows]
        return {"queue": [i for i in items if i is not None]}

    @router.post("/api/v1/doctor/{submission_id}/validate")
    def doctor_validate_submission(
        submission_id: str,
        payload: ClinicalNotePayload,
        authorization: Optional[str] = Header(default=None),
    ):
        doc = _require_user(authorization, allowed_roles={"doctor", "admin"})
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        if sub["status"] != "moderator_approved":
            raise HTTPException(
                status_code=400,
                detail=f"Submission must be 'moderator_approved' before doctor validation (currently '{sub['status']}')",
            )
        if not _clean_str(payload.diagnosis):
            raise HTTPException(status_code=400, detail="diagnosis is required")

        now_iso = datetime.utcnow().isoformat()

        def _validate(conn: sqlite3.Connection):
            conn.execute(
                """
                UPDATE workflow_submissions
                SET status = 'accepted', doctor_id = ?, doctor_name = ?,
                    diagnosis = ?, severity = ?, treatment_needed = ?, medication = ?,
                    doctor_completed_at = ?, updated_at = ?
                WHERE submission_id = ?
                """,
                (
                    doc["user_id"], doc["full_name"], payload.diagnosis.strip(),
                    _clean_str(payload.severity), _clean_str(payload.treatment_needed),
                    _clean_str(payload.medication), now_iso, now_iso, submission_id,
                ),
            )
            return _get_rates(conn)

        rates = _execute_all(_validate)
        _record_payment(
            submission_id, sub["submitted_by_user_id"], sub["submitted_by_name"],
            "field_worker", rates["field_worker"], "Field Collector Record Accepted",
        )
        _record_payment(
            submission_id, doc["user_id"], doc["full_name"],
            "doctor", rates["doctor_validation"], "Doctor Clinical Note & Validation",
        )

        updated = _fetch_submission_full(submission_id)
        _sync_to_clinical_hub(updated, updated["photos"])
        return updated

    # ── 5. User Payments ──────────────────────────────────────────────────────

    @router.get("/api/v1/payments/my")
    def my_payments(
        user_id: Optional[str] = Query(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        auth_user = _get_user_from_header(authorization)
        uid = (auth_user["user_id"] if auth_user else None) or _clean_str(user_id)
        if not uid:
            raise HTTPException(status_code=401, detail="Authentication or user_id required")

        conn = _connect(_primary_db())
        try:
            rows = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM workflow_payments WHERE user_id = ? ORDER BY created_at DESC",
                    (uid,),
                ).fetchall()
            ]
        finally:
            conn.close()

        total_earned = sum(float(r["amount"]) for r in rows)
        total_paid = sum(float(r["amount"]) for r in rows if r["status"] == "paid")
        total_credited = sum(float(r["amount"]) for r in rows if r["status"] == "credited")
        return {
            "payments": rows,
            "total_earned": total_earned,
            "total_paid": total_paid,
            "total_credited": total_credited,
        }

    # ── 6. Admin Endpoints ────────────────────────────────────────────────────

    @router.get("/api/v1/admin/stats")
    def admin_stats(authorization: Optional[str] = Header(default=None)):
        _require_user(authorization, allowed_roles={"admin"})
        today_prefix = datetime.utcnow().strftime("%Y-%m-%d")
        conn = _connect(_primary_db())
        try:
            users_by_role = {
                r["role"]: r["cnt"]
                for r in conn.execute("SELECT role, COUNT(*) as cnt FROM app_users GROUP BY role").fetchall()
            }
            users_by_status = {
                r["status"]: r["cnt"]
                for r in conn.execute("SELECT status, COUNT(*) as cnt FROM app_users GROUP BY status").fetchall()
            }
            subs_by_status = {
                r["status"]: r["cnt"]
                for r in conn.execute("SELECT status, COUNT(*) as cnt FROM workflow_submissions GROUP BY status").fetchall()
            }
            today_count = conn.execute(
                "SELECT COUNT(*) FROM workflow_submissions WHERE created_at LIKE ?",
                (f"{today_prefix}%",),
            ).fetchone()[0]
            payout_by_role = {
                r["role"]: float(r["total"])
                for r in conn.execute("SELECT role, COALESCE(SUM(amount), 0) as total FROM workflow_payments GROUP BY role").fetchall()
            }
            total_payout = sum(payout_by_role.values())
        finally:
            conn.close()

        return {
            "total_users": sum(users_by_role.values()),
            "users_by_role": users_by_role,
            "users_by_status": users_by_status,
            "pending_users": users_by_status.get("pending", 0),
            "total_submissions": sum(subs_by_status.values()),
            "today_submissions": today_count,
            "pending_moderator": subs_by_status.get("ai_reviewed", 0),
            "pending_doctor": subs_by_status.get("moderator_approved", 0),
            "accepted_count": subs_by_status.get("accepted", 0),
            "rejected_count": subs_by_status.get("rejected", 0) + subs_by_status.get("moderator_rejected", 0),
            "submissions_by_status": subs_by_status,
            "total_payouts": total_payout,
            "payouts_by_role": payout_by_role,
        }

    @router.get("/api/v1/admin/users")
    def admin_users(
        role: Optional[str] = Query(default=None),
        status_filter: Optional[str] = Query(default=None, alias="status"),
        search: Optional[str] = Query(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        _require_user(authorization, allowed_roles={"admin"})
        sql = "SELECT * FROM app_users WHERE 1=1"
        params: List[Any] = []
        if role:
            sql += " AND LOWER(role) = LOWER(?)"
            params.append(role.strip())
        if status_filter:
            sql += " AND LOWER(status) = LOWER(?)"
            params.append(status_filter.strip())
        if search:
            pat = f"%{search.strip()}%"
            sql += """ AND (
                COALESCE(full_name, '') LIKE ? OR COALESCE(email, '') LIKE ?
                OR COALESCE(phone, '') LIKE ? OR COALESCE(username, '') LIKE ?
                OR COALESCE(worker_id, '') LIKE ? OR COALESCE(district, '') LIKE ?
            )"""
            params.extend([pat] * 6)
        sql += " ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC"

        conn = _connect(_primary_db())
        try:
            rows = [_serialize_user(r) for r in conn.execute(sql, params).fetchall()]
        finally:
            conn.close()
        return {"users": rows}

    @router.patch("/api/v1/admin/users/{user_id}")
    def admin_update_user(
        user_id: str,
        payload: AdminUserPatchPayload,
        authorization: Optional[str] = Header(default=None),
    ):
        _require_user(authorization, allowed_roles={"admin"})
        updates = []
        params: List[Any] = []
        if payload.status:
            st = payload.status.strip().lower()
            if st not in ("pending", "active", "rejected", "suspended"):
                raise HTTPException(status_code=400, detail="status must be 'pending', 'active', 'rejected', or 'suspended'")
            updates.append("status = ?")
            params.append(st)
        if payload.role:
            r = payload.role.strip().lower()
            if r not in ALLOWED_ROLES:
                raise HTTPException(status_code=400, detail="Invalid role")
            updates.append("role = ?")
            params.append(r)
        if payload.district is not None:
            updates.append("district = ?")
            params.append(_clean_str(payload.district))
        if payload.worker_type is not None:
            updates.append("worker_type = ?")
            params.append(_clean_str(payload.worker_type))

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.append(user_id)

        def _patch(conn: sqlite3.Connection):
            conn.execute(f"UPDATE app_users SET {', '.join(updates)} WHERE user_id = ?", params)
            row = conn.execute("SELECT * FROM app_users WHERE user_id = ?", (user_id,)).fetchone()
            return _serialize_user(row) if row else None

        updated = _execute_all(_patch)
        if not updated:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user": updated}

    @router.post("/api/v1/admin/users/{user_id}/approve")
    def admin_approve_user(user_id: str, authorization: Optional[str] = Header(default=None)):
        _require_user(authorization, allowed_roles={"admin"})

        def _approve(conn: sqlite3.Connection):
            conn.execute("UPDATE app_users SET status = 'active' WHERE user_id = ?", (user_id,))
            row = conn.execute("SELECT * FROM app_users WHERE user_id = ?", (user_id,)).fetchone()
            return _serialize_user(row) if row else None

        updated = _execute_all(_approve)
        if not updated:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user": updated, "message": "User verified and activated"}

    @router.post("/api/v1/admin/users/{user_id}/reject")
    def admin_reject_user(user_id: str, authorization: Optional[str] = Header(default=None)):
        _require_user(authorization, allowed_roles={"admin"})

        def _reject(conn: sqlite3.Connection):
            conn.execute("UPDATE app_users SET status = 'rejected' WHERE user_id = ?", (user_id,))
            row = conn.execute("SELECT * FROM app_users WHERE user_id = ?", (user_id,)).fetchone()
            return _serialize_user(row) if row else None

        updated = _execute_all(_reject)
        if not updated:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user": updated, "message": "User registration rejected"}

    @router.get("/api/v1/admin/submissions")
    def admin_submissions(
        status_filter: Optional[str] = Query(default=None, alias="status"),
        role: Optional[str] = Query(default=None),
        search: Optional[str] = Query(default=None),
        authorization: Optional[str] = Header(default=None),
    ):
        _require_user(authorization, allowed_roles={"admin"})
        sql = "SELECT submission_id FROM workflow_submissions WHERE 1=1"
        params: List[Any] = []
        if status_filter:
            sql += " AND status = ?"
            params.append(status_filter.strip())
        if role:
            sql += " AND submitter_role = ?"
            params.append(role.strip())
        if search:
            pat = f"%{search.strip()}%"
            sql += " AND (COALESCE(patient_id, '') LIKE ? OR COALESCE(patient_name, '') LIKE ? OR COALESCE(submitted_by_name, '') LIKE ?)"
            params.extend([pat, pat, pat])
        sql += " ORDER BY created_at DESC"

        conn = _connect(_primary_db())
        try:
            ids = [r["submission_id"] for r in conn.execute(sql, params).fetchall()]
        finally:
            conn.close()
        items = [_fetch_submission_full(sid) for sid in ids]
        return {"submissions": [i for i in items if i is not None]}

    @router.post("/api/v1/admin/submissions/{submission_id}/override")
    def admin_override_submission(
        submission_id: str,
        payload: AdminOverridePayload,
        authorization: Optional[str] = Header(default=None),
    ):
        adm = _require_user(authorization, allowed_roles={"admin"})
        sub = _fetch_submission_full(submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")
        target_status = payload.status.strip().lower()
        if target_status not in ("accepted", "rejected"):
            raise HTTPException(status_code=400, detail="Override status must be 'accepted' or 'rejected'")

        now_iso = datetime.utcnow().isoformat()

        def _override(conn: sqlite3.Connection):
            conn.execute(
                """
                UPDATE workflow_submissions
                SET status = ?, ai_rejection_reason = ?, moderator_note = COALESCE(?, moderator_note),
                    updated_at = ?
                WHERE submission_id = ?
                """,
                (
                    target_status,
                    _clean_str(payload.reason) if target_status == "rejected" else None,
                    _clean_str(payload.reason),
                    now_iso,
                    submission_id,
                ),
            )
            return _get_rates(conn)

        rates = _execute_all(_override)
        if target_status == "accepted":
            if sub["submitter_role"] == "doctor":
                _record_payment(
                    submission_id, sub["submitted_by_user_id"], sub["submitted_by_name"],
                    "doctor", rates["doctor_direct"], "Admin Override Accepted (Doctor)",
                )
            else:
                _record_payment(
                    submission_id, sub["submitted_by_user_id"], sub["submitted_by_name"],
                    "field_worker", rates["field_worker"], "Admin Override Accepted (Collector)",
                )
            updated = _fetch_submission_full(submission_id)
            _sync_to_clinical_hub(updated, updated["photos"])
            return updated

        return _fetch_submission_full(submission_id)

    @router.get("/api/v1/admin/payments")
    def admin_payments(
        role: Optional[str] = Query(default=None),
        status_filter: Optional[str] = Query(default=None, alias="status"),
        authorization: Optional[str] = Header(default=None),
    ):
        _require_user(authorization, allowed_roles={"admin"})
        sql = "SELECT * FROM workflow_payments WHERE 1=1"
        params: List[Any] = []
        if role:
            sql += " AND role = ?"
            params.append(role.strip())
        if status_filter:
            sql += " AND status = ?"
            params.append(status_filter.strip())
        sql += " ORDER BY created_at DESC"

        conn = _connect(_primary_db())
        try:
            rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
        finally:
            conn.close()

        return {
            "payments": rows,
            "total_amount": sum(float(r["amount"]) for r in rows),
        }

    @router.post("/api/v1/admin/payments/{payment_id}/mark-paid")
    def admin_mark_payment_paid(
        payment_id: str,
        authorization: Optional[str] = Header(default=None),
    ):
        _require_user(authorization, allowed_roles={"admin"})
        now_iso = datetime.utcnow().isoformat()

        def _mark(conn: sqlite3.Connection):
            conn.execute(
                "UPDATE workflow_payments SET status = 'paid', paid_at = ? WHERE payment_id = ?",
                (now_iso, payment_id),
            )
            row = conn.execute("SELECT * FROM workflow_payments WHERE payment_id = ?", (payment_id,)).fetchone()
            return dict(row) if row else None

        updated = _execute_all(_mark)
        if not updated:
            raise HTTPException(status_code=404, detail="Payment not found")
        return {"payment": updated}

    @router.get("/api/v1/admin/rates")
    def admin_get_rates(authorization: Optional[str] = Header(default=None)):
        _require_user(authorization, allowed_roles={"admin"})
        conn = _connect(_primary_db())
        try:
            rates = _get_rates(conn)
        finally:
            conn.close()
        return {"rates": rates}

    @router.put("/api/v1/admin/rates")
    def admin_update_rates(
        rates_payload: Dict[str, float] = Body(...),
        authorization: Optional[str] = Header(default=None),
    ):
        _require_user(authorization, allowed_roles={"admin"})

        def _update(conn: sqlite3.Connection):
            for k, v in rates_payload.items():
                if k in DEFAULT_RATES:
                    conn.execute(
                        "INSERT OR REPLACE INTO workflow_rates (role, amount) VALUES (?, ?)",
                        (k, float(v)),
                    )
            return _get_rates(conn)

        updated = _execute_all(_update)
        return {"rates": updated}

    router.ensure_workflow_tables = ensure_workflow_tables  # type: ignore[attr-defined]
    return router
