"""
HealthScreen local Flask API for React Native dev.

- Listens on 0.0.0.0:5001 (required for Android emulator → host via 10.0.2.2)
- JSON envelope: { success, data, error }
- JWT access + refresh for /api/v1/auth/*
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any

import jwt
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

UTC = timezone.utc
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-only-change-in-production")
JWT_ALGO = "HS256"
ACCESS_MINUTES = int(os.environ.get("JWT_ACCESS_MINUTES", "60"))
REFRESH_DAYS = int(os.environ.get("JWT_REFRESH_DAYS", "30"))

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dev.sqlite")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                phone TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'patient',
                password_hash TEXT NOT NULL,
                full_name TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(phone, role)
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS asha_patients (
                id TEXT PRIMARY KEY,
                client_patient_id TEXT,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS asha_workers (
                id TEXT PRIMARY KEY,
                worker_id TEXT NOT NULL UNIQUE,
                pin_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                village TEXT,
                district TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS patients (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL UNIQUE,
                age INTEGER,
                gender TEXT,
                village TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS wound_sites (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                foot_side TEXT NOT NULL,
                location_on_foot TEXT NOT NULL,
                first_detected_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS asha_training_modules (
                asha_id TEXT NOT NULL,
                module_code TEXT NOT NULL,
                passed INTEGER NOT NULL DEFAULT 0,
                score REAL,
                attempts INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                PRIMARY KEY (asha_id, module_code)
            )
            """
        )
        _seed_demo_accounts(c)


def _seed_demo_accounts(c: sqlite3.Connection) -> None:
    """Demo credentials shown in the ASHA login UI: asha001 / 1234."""
    created = datetime.now(tz=UTC).isoformat()
    if not c.execute(
        "SELECT 1 FROM asha_workers WHERE lower(worker_id) = ?",
        ("asha001",),
    ).fetchone():
        c.execute(
            """
            INSERT INTO asha_workers (id, worker_id, pin_hash, name, village, district, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                str(uuid.uuid4()),
                "asha001",
                generate_password_hash("1234"),
                "ASHA Demo Worker",
                "Demo village",
                "South 24 Parganas",
                created,
            ),
        )
    if not c.execute("SELECT 1 FROM asha_workers WHERE lower(worker_id) = ?", ("asha002",)).fetchone():
        c.execute(
            """
            INSERT INTO asha_workers (id, worker_id, pin_hash, name, village, district, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                str(uuid.uuid4()),
                "asha002",
                generate_password_hash("1234"),
                "ASHA Worker Two",
                "Demo village",
                "South 24 Parganas",
                created,
            ),
        )


def normalize_phone(raw: str | None) -> str:
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def ok(data: Any, status: int = 200):
    return jsonify({"success": True, "data": data, "error": None}), status


def err(message: str, code: str = "BAD_REQUEST", status: int = 400):
    return (
        jsonify(
            {
                "success": False,
                "data": None,
                "error": {"code": code, "message": message},
            }
        ),
        status,
    )


def issue_tokens(user_id: str, phone: str, role: str) -> dict[str, Any]:
    now = datetime.now(tz=UTC)
    access = jwt.encode(
        {
            "sub": user_id,
            "phone": phone,
            "role": role,
            "typ": "access",
            "iat": now,
            "exp": now + timedelta(minutes=ACCESS_MINUTES),
        },
        JWT_SECRET,
        algorithm=JWT_ALGO,
    )
    refresh = jwt.encode(
        {
            "sub": user_id,
            "phone": phone,
            "role": role,
            "typ": "refresh",
            "iat": now,
            "exp": now + timedelta(days=REFRESH_DAYS),
        },
        JWT_SECRET,
        algorithm=JWT_ALGO,
    )
    return {
        "token": access,
        "refresh_token": refresh,
        "user_id": user_id,
        "role": role,
    }


_TRAINING_SPECS: tuple[tuple[str, str], ...] = (
    ("MODULE_WOUND_IMAGING", "Wound photography basics"),
    ("MODULE_COIN_PLACEMENT", "Coin placement for scale"),
    ("MODULE_REFERRAL", "Referral & urgent cases"),
    ("MODULE_PRIVACY", "Privacy & consent"),
)


def _ensure_training_modules(c: sqlite3.Connection, asha_id: str) -> None:
    for code, _title in _TRAINING_SPECS:
        if not c.execute(
            "SELECT 1 FROM asha_training_modules WHERE asha_id = ? AND module_code = ?",
            (asha_id, code),
        ).fetchone():
            c.execute(
                """
                INSERT INTO asha_training_modules (asha_id, module_code, passed, attempts)
                VALUES (?, ?, 0, 0)
                """,
                (asha_id, code),
            )


def require_jwt(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return err("Missing or invalid Authorization header", "UNAUTHORIZED", 401)
        token = auth[7:].strip()
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
            if payload.get("typ") != "access":
                return err("Invalid token type", "UNAUTHORIZED", 401)
            g.jwt = payload
        except jwt.ExpiredSignatureError:
            return err("Token expired", "TOKEN_EXPIRED", 401)
        except jwt.InvalidTokenError:
            return err("Invalid token", "UNAUTHORIZED", 401)
        return f(*args, **kwargs)

    return wrapped


def require_asha(f):
    @wraps(f)
    @require_jwt
    def wrapped(*args, **kwargs):
        if g.jwt.get("role") != "asha":
            return err("ASHA role required", "FORBIDDEN", 403)
        return f(*args, **kwargs)

    return wrapped


def create_app() -> Flask:
    init_db()
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    @app.get("/api/v1/health")
    def health():
        return ok({"status": "ok", "service": "healthscreen-api"})

    def _do_register():
        body = request.get_json(silent=True) or {}
        phone = normalize_phone(
            body.get("phone_number") or body.get("phone") or body.get("mobile")
        )
        password = str(
            body.get("password") or body.get("pin") or body.get("pin_code") or ""
        )
        full_name = (body.get("full_name") or body.get("name") or "").strip() or "User"
        role = (body.get("role") or "patient").lower()
        if role not in ("patient", "asha"):
            role = "patient"
        if len(phone) < 10:
            return err("Valid phone_number is required", "VALIDATION", 422)
        if len(password) < 4:
            return err("Password or PIN must be at least 4 characters", "VALIDATION", 422)

        pw_hash = generate_password_hash(password)
        uid = str(uuid.uuid4())
        created = datetime.now(tz=UTC).isoformat()

        with _conn() as c:
            row = c.execute(
                "SELECT id, password_hash FROM users WHERE phone = ? AND role = ?",
                (phone, role),
            ).fetchone()
            if row:
                if check_password_hash(row["password_hash"], password):
                    tokens = issue_tokens(row["id"], phone, role)
                    tokens["profile"] = {"full_name": full_name, "phone": phone}
                    return ok(tokens)
                return err("Account exists for this phone with a different password", "CONFLICT", 409)
            c.execute(
                """
                INSERT INTO users (id, phone, role, password_hash, full_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (uid, phone, role, pw_hash, full_name, created),
            )

        tokens = issue_tokens(uid, phone, role)
        tokens["profile"] = {"full_name": full_name, "phone": phone}
        return ok(tokens, 201)

    @app.post("/api/v1/auth/register")
    def auth_register():
        return _do_register()

    @app.post("/api/v1/auth/signup")
    def auth_signup():
        return _do_register()

    @app.post("/api/v1/auth/asha/login")
    def asha_login():
        body = request.get_json(silent=True) or {}
        worker_id = str(body.get("worker_id", "")).strip().lower()
        pin = str(body.get("pin", "")).strip()
        if not worker_id or not pin:
            return err("worker_id and pin required", "VALIDATION", 400)

        with _conn() as c:
            row = c.execute(
                """
                SELECT id, worker_id, pin_hash, name, village, district, active
                FROM asha_workers WHERE lower(worker_id) = ?
                """,
                (worker_id,),
            ).fetchone()

        if not row:
            return err("Invalid credentials", "UNAUTHORIZED", 401)
        if not row["active"]:
            return err("Inactive worker", "FORBIDDEN", 403)
        if not check_password_hash(row["pin_hash"], pin):
            return err("Invalid credentials", "UNAUTHORIZED", 401)

        tokens = issue_tokens(row["id"], row["worker_id"], "asha")
        return ok(
            {
                **tokens,
                "asha": {
                    "id": row["id"],
                    "worker_id": row["worker_id"],
                    "name": row["name"],
                    "village": row["village"] or "",
                    "district": row["district"] or "",
                },
            }
        )

    @app.post("/api/v1/auth/patient/register")
    def patient_register():
        body = request.get_json(silent=True) or {}
        name = (body.get("name") or "").strip()
        phone = normalize_phone(body.get("phone"))
        age = body.get("age")
        gender = (body.get("gender") or "").strip()
        village = (body.get("village") or "").strip()
        if not name or len(phone) < 10:
            return err("name and valid phone required", "VALIDATION", 400)

        pid = str(uuid.uuid4())
        created = datetime.now(tz=UTC).isoformat()
        try:
            age_i = int(age) if age is not None else None
        except (TypeError, ValueError):
            age_i = None

        with _conn() as c:
            if c.execute("SELECT 1 FROM patients WHERE phone = ?", (phone,)).fetchone():
                return err("Phone already registered", "DUPLICATE", 409)
            c.execute(
                """
                INSERT INTO patients (id, name, phone, age, gender, village, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (pid, name, phone, age_i, gender, village, created),
            )

        tokens = issue_tokens(pid, phone, "patient")
        return ok(
            {
                **tokens,
                "patient": {
                    "id": pid,
                    "name": name,
                    "phone": phone,
                    "age": age_i,
                    "gender": gender,
                    "village": village,
                },
            },
            201,
        )

    @app.post("/api/v1/auth/patient/login")
    def patient_login():
        body = request.get_json(silent=True) or {}
        phone = normalize_phone(body.get("phone"))
        if len(phone) < 10:
            return err("Valid phone required", "VALIDATION", 400)

        with _conn() as c:
            row = c.execute(
                "SELECT id, name, phone, age, gender, village FROM patients WHERE phone = ?",
                (phone,),
            ).fetchone()

        if not row:
            return err("Patient not found", "NOT_FOUND", 404)

        tokens = issue_tokens(row["id"], row["phone"], "patient")
        return ok(
            {
                **tokens,
                "patient": {
                    "id": row["id"],
                    "name": row["name"],
                    "phone": row["phone"],
                    "age": row["age"],
                    "gender": row["gender"],
                    "village": row["village"],
                },
            }
        )

    @app.post("/api/v1/auth/login")
    def auth_login():
        body = request.get_json(silent=True) or {}
        phone = normalize_phone(
            body.get("phone_number") or body.get("phone") or body.get("mobile")
        )
        password = str(body.get("password") or body.get("pin") or "")
        role = (body.get("role") or "patient").lower()
        if role not in ("patient", "asha"):
            role = "patient"
        if len(phone) < 10 or len(password) < 4:
            return err("Invalid phone or password", "UNAUTHORIZED", 401)

        with _conn() as c:
            row = c.execute(
                "SELECT id, password_hash, full_name FROM users WHERE phone = ? AND role = ?",
                (phone, role),
            ).fetchone()
        if not row or not check_password_hash(row["password_hash"], password):
            return err("Invalid phone or password", "UNAUTHORIZED", 401)

        tokens = issue_tokens(row["id"], phone, role)
        tokens["profile"] = {"full_name": row["full_name"], "phone": phone}
        return ok(tokens)

    @app.post("/api/v1/auth/refresh")
    def auth_refresh():
        auth = request.headers.get("Authorization", "")
        token = None
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
        if not token:
            body = request.get_json(silent=True) or {}
            token = body.get("refresh_token")
        if not token:
            return err("refresh_token required", "UNAUTHORIZED", 401)
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
            if payload.get("typ") != "refresh":
                return err("Not a refresh token", "UNAUTHORIZED", 401)
            uid = payload["sub"]
            phone = payload.get("phone", "")
            role = payload.get("role", "patient")
        except jwt.ExpiredSignatureError:
            return err("Refresh token expired", "TOKEN_EXPIRED", 401)
        except jwt.InvalidTokenError:
            return err("Invalid refresh token", "UNAUTHORIZED", 401)

        with _conn() as c:
            row = c.execute("SELECT id, phone, role FROM users WHERE id = ?", (uid,)).fetchone()
        if not row:
            return err("User not found", "UNAUTHORIZED", 401)

        tokens = issue_tokens(row["id"], row["phone"], row["role"])
        return ok(tokens)

    # --- ASHA patient sync (no JWT; matches patientRemoteSync fetch) ---
    @app.post("/api/v1/asha/patients")
    def asha_patients():
        body = request.get_json(silent=True) or {}
        rid = str(uuid.uuid4())
        created = datetime.now(tz=UTC).isoformat()

        with _conn() as c:
            c.execute(
                """
                INSERT INTO asha_patients (id, client_patient_id, payload_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (rid, body.get("client_patient_id"), json.dumps(body), created),
            )
        return ok({"patient_id": rid, "synced": True}, 201)

    # --- Authenticated stubs used by the app ---
    @app.get("/api/v1/patients/me/wound-sites")
    @require_jwt
    def wound_sites_list():
        pid = g.jwt["sub"]
        with _conn() as c:
            rows = c.execute(
                """
                SELECT id, foot_side, location_on_foot, first_detected_date, status
                FROM wound_sites WHERE patient_id = ? ORDER BY created_at DESC
                """,
                (pid,),
            ).fetchall()
        items = [
            {
                "id": r["id"],
                "foot_side": r["foot_side"],
                "location_on_foot": r["location_on_foot"],
                "first_detected_date": r["first_detected_date"],
                "status": r["status"],
            }
            for r in rows
        ]
        return ok({"items": items})

    @app.post("/api/v1/patients/me/wound-sites")
    @require_jwt
    def wound_sites_create():
        if g.jwt.get("role") != "patient":
            return err("Patient role required", "FORBIDDEN", 403)
        body = request.get_json(silent=True) or {}
        foot_side = str(body.get("foot_side", "")).strip().upper()
        location = str(body.get("location_on_foot", "")).strip().upper()
        first_date = str(body.get("first_detected_date", "")).strip()
        if foot_side not in ("LEFT", "RIGHT"):
            return err("foot_side must be LEFT or RIGHT", "VALIDATION", 400)
        if location not in ("HALLUX", "FOREFOOT", "MIDFOOT", "HEEL"):
            return err("Invalid location_on_foot", "VALIDATION", 400)
        if not first_date:
            return err("first_detected_date required", "VALIDATION", 400)
        wid = str(uuid.uuid4())
        created = datetime.now(tz=UTC).isoformat()
        pid = g.jwt["sub"]
        try:
            with _conn() as c:
                c.execute(
                    """
                    INSERT INTO wound_sites
                    (id, patient_id, foot_side, location_on_foot, first_detected_date, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
                    """,
                    (wid, pid, foot_side, location, first_date, created),
                )
        except sqlite3.Error as e:
            return err(f"Database error: {e}", "SERVER", 500)
        return ok(
            {
                "wound_site": {
                    "id": wid,
                    "foot_side": foot_side,
                    "location_on_foot": location,
                    "first_detected_date": first_date,
                    "status": "ACTIVE",
                }
            },
            201,
        )

    @app.post("/api/v1/asha/patients/<patient_id>/wound-sites")
    @require_asha
    def asha_wound_sites_create(patient_id: str):
        body = request.get_json(silent=True) or {}
        foot_side = str(body.get("foot_side", "")).strip().upper()
        location = str(body.get("location_on_foot", "")).strip().upper()
        first_date = str(body.get("first_detected_date", "")).strip()
        if foot_side not in ("LEFT", "RIGHT"):
            return err("foot_side must be LEFT or RIGHT", "VALIDATION", 400)
        if location not in ("HALLUX", "FOREFOOT", "MIDFOOT", "HEEL"):
            return err("Invalid location_on_foot", "VALIDATION", 400)
        if not first_date:
            return err("first_detected_date required", "VALIDATION", 400)
        wid = str(uuid.uuid4())
        created = datetime.now(tz=UTC).isoformat()
        with _conn() as c:
            if not c.execute("SELECT 1 FROM patients WHERE id = ?", (patient_id,)).fetchone():
                return err("Patient not found", "NOT_FOUND", 404)
            c.execute(
                """
                INSERT INTO wound_sites
                (id, patient_id, foot_side, location_on_foot, first_detected_date, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                (wid, patient_id, foot_side, location, first_date, created),
            )
        return ok(
            {
                "wound_site": {
                    "id": wid,
                    "patient_id": patient_id,
                    "foot_side": foot_side,
                    "location_on_foot": location,
                    "first_detected_date": first_date,
                }
            },
            201,
        )

    @app.post("/api/v1/sessions")
    @require_jwt
    def create_monitoring_session():
        body = request.get_json(silent=True) or {}
        patient_id = str(body.get("patient_id", "")).strip()
        wound_site_id = str(body.get("wound_site_id", "")).strip()
        submission_method = str(body.get("submission_method", "PATIENT_SELF")).strip().upper()
        if not patient_id or not wound_site_id:
            return err("patient_id and wound_site_id required", "VALIDATION", 400)
        if submission_method not in ("ASHA_ASSISTED", "PATIENT_SELF"):
            return err("Invalid submission_method", "VALIDATION", 400)
        sid = str(uuid.uuid4())
        created = datetime.now(tz=UTC).isoformat()
        ai_risk = str(body.get("ai_risk_level", "low")).lower()
        if ai_risk not in ("low", "medium", "high"):
            ai_risk = "low"
        return ok(
            {
                "session": {
                    "id": sid,
                    "patient_id": patient_id,
                    "wound_site_id": wound_site_id,
                    "submission_method": submission_method,
                    "session_type": body.get("session_type") or "WOUND_MONITOR",
                    "status": "COMPLETED",
                    "ai_risk_level": ai_risk,
                    "created_at": created,
                },
                "session_id": sid,
            },
            201,
        )

    @app.post("/api/v1/patients/me/medical-history")
    @require_jwt
    def medical_history():
        return ok({"medical_history_id": str(uuid.uuid4()), "version_number": 1}, 201)

    @app.post("/api/v1/patients/me/consent")
    @require_jwt
    def consent():
        return ok({"consent_id": str(uuid.uuid4())}, 201)

    @app.get("/api/v1/asha/me/training")
    @require_asha
    def asha_training_status():
        asha_id = g.jwt["sub"]
        titles = dict(_TRAINING_SPECS)
        with _conn() as c:
            _ensure_training_modules(c, asha_id)
            rows = c.execute(
                """
                SELECT module_code, passed, score, attempts, completed_at
                FROM asha_training_modules
                WHERE asha_id = ?
                ORDER BY module_code
                """,
                (asha_id,),
            ).fetchall()
        modules = [
            {
                "module_code": r["module_code"],
                "title": titles.get(r["module_code"], r["module_code"]),
                "passed": bool(r["passed"]),
                "score": r["score"],
                "attempts": r["attempts"] or 0,
                "completed_at": r["completed_at"],
            }
            for r in rows
        ]
        all_passed = all(m["passed"] for m in modules) if modules else False
        return ok({"modules": modules, "all_passed": all_passed})

    @app.post("/api/v1/asha/me/training/complete")
    @require_asha
    def asha_training_complete():
        asha_id = g.jwt["sub"]
        body = request.get_json(silent=True) or {}
        code = str(body.get("module_code", "")).strip()
        if not code:
            return err("module_code required", "VALIDATION", 400)
        valid_codes = {c for c, _ in _TRAINING_SPECS}
        if code not in valid_codes:
            return err("Unknown module_code", "NOT_FOUND", 404)
        score = body.get("score")
        score_f = float(score) if score is not None else 100.0
        completed = datetime.now(tz=UTC).isoformat()
        with _conn() as c:
            _ensure_training_modules(c, asha_id)
            c.execute(
                """
                UPDATE asha_training_modules
                SET passed = 1, score = ?, attempts = attempts + 1, completed_at = ?
                WHERE asha_id = ? AND module_code = ?
                """,
                (score_f, completed, asha_id, code),
            )
        return ok({"module_code": code, "passed": True, "score": score_f})

    @app.get("/api/v1/asha/me/patients/search")
    @require_asha
    def asha_patients_search():
        q = str(request.args.get("q", "")).strip()
        if len(q) < 2:
            return ok({"items": []})
        like = f"%{q}%"
        with _conn() as c:
            rows = c.execute(
                """
                SELECT id, name, phone, village, age, gender
                FROM patients
                WHERE phone LIKE ? OR name LIKE ? OR village LIKE ?
                ORDER BY name LIMIT 25
                """,
                (like, like, like),
            ).fetchall()
        items = [
            {
                "id": r["id"],
                "name": r["name"],
                "phone": r["phone"],
                "village": r["village"] or "",
                "age": r["age"],
                "gender": r["gender"],
            }
            for r in rows
        ]
        return ok({"items": items})

    @app.get("/api/v1/asha/commissions")
    @require_jwt
    def commissions():
        return ok(
            {
                "total_earned": 0,
                "pending": 0,
                "paid": 0,
                "breakdown": [],
                "history": [],
                "payment_history": [],
            }
        )

    @app.get("/api/v1/teleconsults/me")
    @require_jwt
    def teleconsults_me():
        return ok([])

    @app.post("/api/v1/teleconsults")
    @require_jwt
    def teleconsults_create():
        body = request.get_json(silent=True) or {}
        tid = str(uuid.uuid4())
        return ok(
            {
                "teleconsult_id": tid,
                "estimated_callback_time": body.get("preferred_callback_time"),
            },
            201,
        )

    @app.get("/api/v1/teleconsults/<tid>")
    @require_jwt
    def teleconsult_get(tid: str):
        return ok(
            {
                "id": tid,
                "teleconsult_id": tid,
                "status": "SCHEDULED",
                "request_type": "ROUTINE",
                "assigned_doctor_name": "Dr. Demo",
                "scheduled_callback_time": (
                    datetime.now(tz=UTC) + timedelta(hours=2)
                ).isoformat(),
                "estimated_callback_time": None,
                "doctor_calling_number": "+91-80-0000-0000",
                "can_cancel": True,
                "prescription": None,
            }
        )

    @app.post("/api/v1/teleconsults/<tid>/cancel")
    @require_jwt
    def teleconsult_cancel(tid: str):
        return ok({"cancelled": True, "teleconsult_id": tid})

    @app.post("/api/v1/teleconsults/<tid>/mark-received")
    @require_jwt
    def teleconsult_mark(tid: str):
        return ok({"ok": True})

    @app.put("/api/v1/teleconsults/<tid>/rate")
    @require_jwt
    def teleconsult_rate(tid: str):
        return ok({"ok": True})

    @app.get("/api/v1/notifications/me")
    @require_jwt
    def notifications_me():
        return ok([])

    @app.put("/api/v1/notifications/<nid>/read")
    @require_jwt
    def notifications_read(nid: str):
        return ok({"id": nid, "read": True})

    @app.get("/api/v1/notifications/preferences")
    @require_jwt
    def notif_prefs_get():
        return ok({})

    @app.put("/api/v1/notifications/preferences")
    @require_jwt
    def notif_prefs_put():
        return ok({})

    @app.post("/api/v1/notifications/device-token")
    @require_jwt
    def device_token():
        return ok({"registered": True})

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    # 0.0.0.0: critical — Android emulator uses 10.0.2.2 to reach host; 127.0.0.1-only bind fails.
    print(f"HealthScreen API listening on http://0.0.0.0:{port} (SQLite: {DB_PATH})")
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
