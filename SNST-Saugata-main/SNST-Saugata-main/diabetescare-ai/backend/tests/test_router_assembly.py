"""
Part 14 — FastAPI Router Assembly Tests  (28 tests total)

Category breakdown
──────────────────
 A. Public routes bypass JWT          5 tests
 B. Protected routes → 401 no token   6 tests
 C. Authenticated → non-401           3 tests
 D. Malformed body → 422              3 tests
 E. Full integration smoke test       7 tests
 F. Router registration               4 tests
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database.models import Base, User, Patient, AuditLog
from backend.database.session import get_db
from backend.api.main import app
from backend.api.dependencies import create_access_token
import backend.api.middleware as middleware_module

# ── Shared in-memory SQLite ───────────────────────────────────────────────────
_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_ENGINE)


@pytest.fixture(scope="module", autouse=True)
def setup_schema():
    Base.metadata.create_all(bind=_ENGINE)
    yield
    Base.metadata.drop_all(bind=_ENGINE)


@pytest.fixture(scope="module")
def db_session():
    session = _SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def client(db_session):
    def override_db():
        try:
            yield db_session
        finally:
            pass

    # Patch both the FastAPI dependency and the audit middleware session factory
    app.dependency_overrides[get_db] = override_db

    import backend.api.middleware as mw
    original = mw._get_session_local
    mw._get_session_local = lambda: _SessionLocal

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()
    mw._get_session_local = original


# ── Helpers ───────────────────────────────────────────────────────────────────
def _register_and_login(client, email=None, password="Password1!"):
    email = email or f"u_{uuid.uuid4().hex[:6]}@test.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "role": "doctor"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"], email


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ════════════════════════════════════════════════════════════════════════
# A. PUBLIC ROUTES BYPASS JWT  (5 tests)
# ════════════════════════════════════════════════════════════════════════

def test_A1_health_is_public(client):
    assert client.get("/health").status_code == 200


def test_A2_docs_is_public(client):
    r = client.get("/docs")
    assert r.status_code in (200, 301, 302)


def test_A3_openapi_json_is_public(client):
    assert client.get("/openapi.json").status_code == 200


def test_A4_auth_login_publicly_reachable_not_blocked_by_jwt(client):
    r = client.post(
        "/api/v1/auth/login",
        json={},
    )
    assert r.status_code == 422  # 422 from Pydantic proves JWT middleware did not block it


def test_A5_auth_register_does_not_return_401(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": f"pub_{uuid.uuid4().hex[:6]}@test.com", "password": "Pass1!"},
    )
    assert r.status_code != 401


# ════════════════════════════════════════════════════════════════════════
# B. PROTECTED ROUTES → 401 WITHOUT TOKEN  (6 tests)
# ════════════════════════════════════════════════════════════════════════

def test_B1_patients_me_requires_auth(client):
    assert client.get("/api/v1/patients/me").status_code == 401


def test_B2_consent_record_requires_auth(client):
    assert client.post("/api/v1/consent/record", json={}).status_code == 401


def test_B3_consent_pending_requires_auth(client):
    assert client.get("/api/v1/consent/pending-reconsent").status_code == 401


def test_B4_medical_history_requires_auth(client):
    assert client.get("/api/v1/patients/medical-history").status_code == 401


def test_B5_wound_sites_requires_auth(client):
    assert client.post("/api/v1/patients/wound-sites").status_code == 401


def test_B6_screenings_requires_auth(client):
    assert client.get("/api/v1/patients/screenings").status_code == 401


# ════════════════════════════════════════════════════════════════════════
# C. AUTHENTICATED ACCESS → NON-401  (3 tests)
# ════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def auth_token(client):
    token, _ = _register_and_login(client)
    return token


def test_C1_authenticated_patients_me_not_401(client, auth_token):
    r = client.get("/api/v1/patients/me", headers=_bearer(auth_token))
    assert r.status_code != 401


def test_C2_authenticated_consent_record_not_401(client, auth_token, db_session):
    # Need a real patient for the consent endpoint
    p = Patient(pseudonym=f"c2_{uuid.uuid4().hex[:8]}", age_band="30-34", district="Delhi")
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)

    r = client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(p.patient_id),
            "consent_stage":  1,
            "data_use_scope": {"purpose": "test"},
        },
        headers=_bearer(auth_token),
    )
    assert r.status_code != 401


def test_C3_authenticated_consent_pending_not_401(client, auth_token):
    r = client.get("/api/v1/consent/pending-reconsent", headers=_bearer(auth_token))
    assert r.status_code != 401


# ════════════════════════════════════════════════════════════════════════
# D. MALFORMED BODY → 422  (3 tests)
# ════════════════════════════════════════════════════════════════════════

def test_D1_consent_record_missing_all_fields_returns_422(client, auth_token):
    r = client.post(
        "/api/v1/consent/record",
        json={},
        headers=_bearer(auth_token),
    )
    assert r.status_code == 422


def test_D2_consent_record_bad_consent_stage_returns_422(client, auth_token):
    r = client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(uuid.uuid4()),
            "consent_stage":  99,
            "data_use_scope": {"p": "v"},
        },
        headers=_bearer(auth_token),
    )
    assert r.status_code == 422


def test_D3_consent_record_missing_scope_returns_422(client, auth_token):
    r = client.post(
        "/api/v1/consent/record",
        json={"patient_id": str(uuid.uuid4()), "consent_stage": 1},
        headers=_bearer(auth_token),
    )
    assert r.status_code == 422


# ════════════════════════════════════════════════════════════════════════
# E. FULL INTEGRATION SMOKE TEST  (7 tests)
# ════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def smoke(client, db_session):
    results = {}

    # E1
    results["health"] = client.get("/health")

    # E2 — register
    email = f"smoke_{uuid.uuid4().hex[:6]}@test.com"
    results["register"] = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SmokePass1!", "role": "doctor"},
    )

    # E3 — login
    results["login"] = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SmokePass1!"},
    )
    assert results["login"].status_code == 200, results["login"].text
    token   = results["login"].json()["access_token"]
    headers = _bearer(token)

    # E4 — medical-history
    results["medical_history"] = client.get(
        "/api/v1/patients/medical-history",
        headers=headers,
    )

    # E5 — wound-site
    results["wound_site"] = client.post(
        "/api/v1/patients/wound-sites",
        headers=headers,
    )

    # E6 — consent (real patient)
    patient = Patient(
        pseudonym=f"smoke_{uuid.uuid4().hex[:8]}",
        age_band="30-34",
        district="Pune",
    )
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)

    results["consent"] = client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(patient.patient_id),
            "consent_stage":  1,
            "data_use_scope": {"purpose": "smoke_test"},
        },
        headers=headers,
    )

    # E7 — audit trail count (middleware writes to same StaticPool DB)
    db_session.expire_all()
    results["audit_count"] = db_session.query(AuditLog).count()

    return results


def test_E1_health_returns_200(smoke):
    assert smoke["health"].status_code == 200


def test_E2_register_returns_201(smoke):
    assert smoke["register"].status_code == 201


def test_E3_login_returns_200_with_token(smoke):
    assert smoke["login"].status_code == 200
    assert "access_token" in smoke["login"].json()


def test_E4_medical_history_accessible_with_token(smoke):
    assert smoke["medical_history"].status_code != 401


def test_E5_wound_site_accessible_with_token(smoke):
    assert smoke["wound_site"].status_code != 401


def test_E6_consent_record_creates_entry(smoke):
    assert smoke["consent"].status_code == 201
    body = smoke["consent"].json()
    assert body["version"]    == 1
    assert body["is_current"] is True


def test_E7_audit_trail_has_entries(smoke):
    assert smoke["audit_count"] >= 1, "AuditTrailMiddleware must write to audit_logs"


# ════════════════════════════════════════════════════════════════════════
# F. ROUTER REGISTRATION  (4 tests)
# ════════════════════════════════════════════════════════════════════════

def _registered_paths(client) -> set:
    return set(client.get("/openapi.json").json().get("paths", {}).keys())


def test_F1_consent_router_registered(client):
    assert any("/consent" in p for p in _registered_paths(client))


def test_F2_auth_router_registered(client):
    assert any("/auth" in p for p in _registered_paths(client))


def test_F3_patients_router_registered(client):
    assert any("/patients" in p for p in _registered_paths(client))


def test_F4_doctors_router_registered(client):
    assert any("/doctors" in p for p in _registered_paths(client))
