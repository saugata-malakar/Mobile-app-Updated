"""
Part 13 — Consent Versioning Tests
4 test cases:
  1. Version bump: old is_current=False, new is_current=True, version incremented
  2. Simultaneous live stages for same patient
  3. Pending re-consent endpoint returns correct patient list after platform version bump
  4. Consent record immutability after creation
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database.models import Base, Patient, ConsentVersion, User
from backend.database.session import get_db
from backend.api.main import app
from backend.api.dependencies import create_access_token
import backend.api.middleware as middleware_module

# ── Shared in-memory SQLite (StaticPool = all connections share same DB) ──────
_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_ENGINE)


@pytest.fixture(autouse=True)
def setup_db(monkeypatch):
    Base.metadata.create_all(bind=_ENGINE)
    # Patch middleware to use same test session factory
    monkeypatch.setattr(middleware_module, "_get_session_local", lambda: _SessionLocal)
    yield
    Base.metadata.drop_all(bind=_ENGINE)


@pytest.fixture()
def db():
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helpers ───────────────────────────────────────────────────────────────────
def _make_user(db) -> User:
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
    user = User(
        email=f"test_{uuid.uuid4().hex[:6]}@example.com",
        hashed_password=pwd_ctx.hash("testpass"),
        role="doctor",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_patient(db) -> Patient:
    p = Patient(
        pseudonym=f"pseudo_{uuid.uuid4().hex[:8]}",
        age_band="25-29",
        district="Mumbai",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _auth_headers(user: User) -> dict:
    token = create_access_token(subject=str(user.user_id), role=user.role)
    return {"Authorization": f"Bearer {token}"}


# ── Test 1: Version bump ──────────────────────────────────────────────────────
def test_version_bump_old_row_inactive_new_row_current_and_incremented(client, db):
    user    = _make_user(db)
    patient = _make_patient(db)
    headers = _auth_headers(user)

    scope_v1 = {"purpose": "clinical_use", "retention_years": 5}
    scope_v2 = {"purpose": "clinical_use", "retention_years": 7, "research": True}

    # First consent — version 1
    r1 = client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(patient.patient_id),
            "consent_stage":  1,
            "data_use_scope": scope_v1,
        },
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["version"]    == 1
    assert r1.json()["is_current"] is True

    # Version bump — version 2
    r2 = client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(patient.patient_id),
            "consent_stage":  1,
            "data_use_scope": scope_v2,
        },
        headers=headers,
    )
    assert r2.status_code == 201, r2.text
    assert r2.json()["version"]    == 2
    assert r2.json()["is_current"] is True

    # Verify old row is now inactive
    all_rows = (
        db.query(ConsentVersion)
        .filter(
            ConsentVersion.patient_id    == str(patient.patient_id),
            ConsentVersion.consent_stage == 1,
        )
        .order_by(ConsentVersion.version)
        .all()
    )
    assert len(all_rows)            == 2
    assert all_rows[0].version      == 1
    assert all_rows[0].is_current   is False   # bumped to inactive
    assert all_rows[1].version      == 2
    assert all_rows[1].is_current   is True    # new active row


# ── Test 2: Simultaneous live stages ─────────────────────────────────────────
def test_simultaneous_stage1_and_stage2_both_current(client, db):
    user    = _make_user(db)
    patient = _make_patient(db)
    headers = _auth_headers(user)

    r1 = client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(patient.patient_id),
            "consent_stage":  1,
            "data_use_scope": {"purpose": "clinical"},
        },
        headers=headers,
    )
    r2 = client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(patient.patient_id),
            "consent_stage":  2,
            "data_use_scope": {"purpose": "research"},
        },
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text

    active_rows = (
        db.query(ConsentVersion)
        .filter(
            ConsentVersion.patient_id == str(patient.patient_id),
            ConsentVersion.is_current == True,
        )
        .all()
    )
    active_stages = {row.consent_stage for row in active_rows}
    assert active_stages == {1, 2}, "Both stages must be simultaneously active"


# ── Test 3: Pending re-consent ────────────────────────────────────────────────
def test_pending_reconsent_returns_patients_below_platform_version(client, db, monkeypatch):
    user    = _make_user(db)
    patient = _make_patient(db)
    headers = _auth_headers(user)

    # Record version 1 consent
    client.post(
        "/api/v1/consent/record",
        json={
            "patient_id":     str(patient.patient_id),
            "consent_stage":  1,
            "data_use_scope": {"purpose": "clinical"},
        },
        headers=headers,
    )

    # Bump platform required version to 2
    import backend.api.routers.consent as consent_module
    monkeypatch.setattr(consent_module, "PLATFORM_CONSENT_VERSION", 2)

    r = client.get("/api/v1/consent/pending-reconsent", headers=headers)
    assert r.status_code == 200, r.text

    pending = r.json()
    matched = [p for p in pending if p["patient_id"] == str(patient.patient_id)]
    assert len(matched)                 == 1
    assert matched[0]["current_version"]  == 1
    assert matched[0]["required_version"] == 2


# ── Test 4: Immutability ──────────────────────────────────────────────────────
def test_consent_record_is_immutable_via_orm(db):
    patient = _make_patient(db)

    row = ConsentVersion(
        patient_id     = str(patient.patient_id),
        consent_stage  = 1,
        version        = 1,
        data_use_scope = {"purpose": "clinical"},
        is_current     = True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # Direct ORM update must raise ValueError
    row.data_use_scope = {"purpose": "tampered"}
    with pytest.raises(ValueError, match="immutable"):
        db.flush()
