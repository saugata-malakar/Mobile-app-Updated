import os
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

_MOBILE_ROOT = str(Path(__file__).resolve().parents[2])
if _MOBILE_ROOT not in sys.path:
    sys.path.insert(0, _MOBILE_ROOT)

import backend.api.main as main_mod


def _make_sample_wound_jpeg() -> bytes:
    """Create a realistic textured non-blank BGR image with a circular 'coin' and 'wound'."""
    img = np.full((480, 640, 3), 160, dtype=np.uint8)
    rng = np.random.default_rng(42)
    noise = rng.integers(-25, 25, size=img.shape, dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    cv2.circle(img, (320, 240), 75, (60, 60, 200), -1)
    cv2.circle(img, (310, 230), 30, (40, 120, 180), -1)
    cv2.circle(img, (480, 240), 42, (220, 220, 220), -1)
    cv2.circle(img, (480, 240), 42, (40, 40, 40), 3)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


@pytest.fixture(scope="module")
def client():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_db = os.path.join(tmpdir, "test_workflow.db")
        orig_get_dbs = main_mod._get_target_databases
        orig_get_ml = main_mod.get_ml_wound_model

        main_mod._get_target_databases = lambda: [tmp_db]
        main_mod.get_ml_wound_model = lambda: None
        main_mod._workflow_router.ensure_workflow_tables()

        try:
            with TestClient(main_mod.app) as c:
                yield c
        finally:
            main_mod._get_target_databases = orig_get_dbs
            main_mod.get_ml_wound_model = orig_get_ml


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_seeded_demo_accounts_and_multi_identifier_login(client):
    for ident in ("doctor@demo.in", "9831000001", "doctor", "DOC_IITKGP_01"):
        r = client.post("/api/v1/auth/login", json={"identifier": ident, "password": "doctor123"})
        assert r.status_code == 200, f"Failed for {ident}: {r.text}"
        data = r.json()["data"]
        assert data["role"] == "doctor"
        assert data["token"]

    bad = client.post("/api/v1/auth/login", json={"identifier": "doctor@demo.in", "password": "wrong"})
    assert bad.status_code == 401

    for ident, pw, expected_role in (
        ("asha@demo.in", "asha123", "field_worker"),
        ("ICDS_WB_0010", "icds123", "field_worker"),
        ("cho001", "cho123", "field_worker"),
        ("9831000004", "mod123", "moderator"),
        ("admin@hospital.in", "admin123", "admin"),
        ("patient@demo.in", "patient123", "patient"),
    ):
        r = client.post("/api/v1/auth/login", json={"identifier": ident, "password": pw})
        assert r.status_code == 200, r.text
        assert r.json()["data"]["role"] == expected_role


def test_register_all_roles_requires_admin_verification(client):
    reg_doc = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Dr. Amit Sen",
            "role": "doctor",
            "email": "amit.sen@kgp.edu",
            "phone": "9000000001",
            "username": "dramit",
            "specialization": "Podiatry",
            "password": "pass1234",
        },
    )
    assert reg_doc.status_code == 201, reg_doc.text
    doc_data = reg_doc.json()["data"]
    assert doc_data["pending_approval"] is True
    assert doc_data["user"]["status"] == "pending"
    assert "token" not in doc_data

    # Pending account cannot login yet
    pending_login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "dramit", "password": "pass1234"},
    )
    assert pending_login.status_code == 403
    assert "pending" in pending_login.json()["detail"].lower()

    dup = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Dup", "role": "doctor", "email": "amit.sen@kgp.edu", "password": "pass1234"},
    )
    assert dup.status_code == 400

    created_ids = [doc_data["user_id"]]
    for payload in (
        {"full_name": "Kalyani Devi", "role": "field_worker", "worker_type": "CHO", "phone": "9000000002", "district": "Jhargram", "password": "pass1234"},
        {"full_name": "Mod Suman", "role": "moderator", "username": "modsuman", "password": "pass1234"},
        {"full_name": "Admin Raj", "role": "admin", "email": "raj@admin.in", "password": "pass1234"},
        {"full_name": "Patient Rita", "role": "patient", "phone": "9000000009", "password": "pass1234"},
        {"full_name": "Reject Test", "role": "doctor", "email": "rejectme@kgp.edu", "password": "pass1234"},
    ):
        r = client.post("/api/v1/auth/register", json=payload)
        assert r.status_code == 201, r.text
        assert r.json()["data"]["pending_approval"] is True
        created_ids.append(r.json()["data"]["user_id"])

    # Admin verifies pending accounts
    adm_tok = client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@hospital.in", "password": "admin123"},
    ).json()["data"]["token"]

    pending_list = client.get("/api/v1/admin/users?status=pending", headers=_auth(adm_tok))
    assert pending_list.status_code == 200
    assert len(pending_list.json()["users"]) >= 6

    # Approve doctor, field_worker, moderator, admin, patient; reject rejectme@kgp.edu
    for uid in created_ids[:5]:
        app_res = client.post(f"/api/v1/admin/users/{uid}/approve", headers=_auth(adm_tok))
        assert app_res.status_code == 200
        assert app_res.json()["user"]["status"] == "active"

    rej_res = client.post(f"/api/v1/admin/users/{created_ids[5]}/reject", headers=_auth(adm_tok))
    assert rej_res.status_code == 200
    assert rej_res.json()["user"]["status"] == "rejected"

    # Approved doctor & patient can now login and Admin can access all role queues
    doc_login = client.post("/api/v1/auth/login", json={"identifier": "dramit", "password": "pass1234"})
    assert doc_login.status_code == 200, doc_login.text
    doc_tok = doc_login.json()["data"]["token"]
    me = client.get("/api/v1/auth/me", headers=_auth(doc_tok))
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "amit.sen@kgp.edu"

    pat_login = client.post("/api/v1/auth/login", json={"identifier": "9000000009", "password": "pass1234"})
    assert pat_login.status_code == 200, pat_login.text

    # Admin bypasses role checks across all portals
    assert client.get("/api/v1/doctor/queue", headers=_auth(adm_tok)).status_code == 200
    assert client.get("/api/v1/moderator/queue", headers=_auth(adm_tok)).status_code == 200

    # Rejected account cannot login
    rej_login = client.post("/api/v1/auth/login", json={"identifier": "rejectme@kgp.edu", "password": "pass1234"})
    assert rej_login.status_code == 403


def test_doctor_direct_workflow_and_payments(client):
    doc_tok = client.post(
        "/api/v1/auth/login",
        json={"identifier": "dramit", "password": "pass1234"},
    ).json()["data"]["token"]

    sub = client.post(
        "/api/v1/submissions",
        json={
            "patient_name": "Gopal Maity",
            "patient_age": 59,
            "patient_weight_kg": 70.0,
            "bp_systolic": 138,
            "bp_diastolic": 88,
            "blood_sugar": 205.0,
            "comorbidities": ["Type 2 Diabetes", "Hypertension"],
            "district": "Paschim Medinipur",
        },
        headers=_auth(doc_tok),
    )
    assert sub.status_code == 201, sub.text
    sid = sub.json()["submission_id"]

    jpg = _make_sample_wound_jpeg()
    for n, ptype in ((1, "distant"), (2, "medium"), (3, "close")):
        up = client.post(
            f"/api/v1/submissions/{sid}/photos",
            data={"photo_number": str(n), "photo_type": ptype},
            files={"file": (f"p{n}.jpg", jpg, "image/jpeg")},
            headers=_auth(doc_tok),
        )
        assert up.status_code == 201, up.text
        assert up.json()["quality_passed"] is True

    rpt = client.post(
        f"/api/v1/submissions/{sid}/reports",
        files={"file": ("cbc.pdf", b"%PDF-1.4 dummy", "application/pdf")},
        headers=_auth(doc_tok),
    )
    assert rpt.status_code == 201

    note = client.post(
        f"/api/v1/submissions/{sid}/clinical-note",
        json={
            "diagnosis": "Wagner Grade 2 plantar ulcer",
            "severity": "Moderate",
            "treatment_needed": "Debridement + offloading",
            "medication": "Amoxicillin-Clavulanate 625mg BID",
        },
        headers=_auth(doc_tok),
    )
    assert note.status_code == 200

    done = client.post(f"/api/v1/submissions/{sid}/submit", headers=_auth(doc_tok))
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["status"] == "accepted"
    assert body["ai_quality_passed"] is True
    amounts = {p["role"]: p["amount"] for p in body["payments"]}
    assert amounts["doctor"] == 80.0
    assert amounts["doctor_helper"] == 20.0

    pay = client.get("/api/v1/payments/my", headers=_auth(doc_tok)).json()
    assert pay["total_earned"] == 80.0


def test_asha_moderator_doctor_and_admin_workflow(client):
    asha_tok = client.post("/api/v1/auth/login", json={"identifier": "9000000002", "password": "pass1234"}).json()["data"]["token"]
    mod_tok = client.post("/api/v1/auth/login", json={"identifier": "modsuman", "password": "pass1234"}).json()["data"]["token"]
    doc_tok = client.post("/api/v1/auth/login", json={"identifier": "doctor@demo.in", "password": "doctor123"}).json()["data"]["token"]
    adm_tok = client.post("/api/v1/auth/login", json={"identifier": "raj@admin.in", "password": "pass1234"}).json()["data"]["token"]

    sub = client.post(
        "/api/v1/submissions",
        json={
            "patient_name": "Lakshmi Murmu",
            "patient_age": 64,
            "patient_weight_kg": 58.0,
            "bp_systolic": 146,
            "bp_diastolic": 92,
            "blood_sugar": 250.0,
            "comorbidities": ["Type 2 Diabetes"],
        },
        headers=_auth(asha_tok),
    ).json()
    sid = sub["submission_id"]

    jpg = _make_sample_wound_jpeg()
    for n in (1, 2, 3):
        r = client.post(
            f"/api/v1/submissions/{sid}/photos",
            data={"photo_number": str(n)},
            files={"file": (f"asha_{n}.jpg", jpg, "image/jpeg")},
            headers=_auth(asha_tok),
        )
        assert r.status_code == 201

    forb = client.post(
        f"/api/v1/submissions/{sid}/clinical-note",
        json={"diagnosis": "Nope"},
        headers=_auth(asha_tok),
    )
    assert forb.status_code == 403

    submitted = client.post(f"/api/v1/submissions/{sid}/submit", headers=_auth(asha_tok))
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "ai_reviewed"

    mq = client.get("/api/v1/moderator/queue", headers=_auth(mod_tok))
    assert mq.status_code == 200
    assert any(x["submission_id"] == sid for x in mq.json()["queue"])

    ma = client.post(
        f"/api/v1/moderator/{sid}/approve",
        json={"note": "Coin visible, sharp focus"},
        headers=_auth(mod_tok),
    )
    assert ma.status_code == 200
    assert ma.json()["status"] == "moderator_approved"

    dq = client.get("/api/v1/doctor/queue", headers=_auth(doc_tok))
    assert dq.status_code == 200
    assert any(x["submission_id"] == sid for x in dq.json()["queue"])

    dv = client.post(
        f"/api/v1/doctor/{sid}/validate",
        json={
            "diagnosis": "Superficial neuropathic ulcer",
            "severity": "Mild",
            "treatment_needed": "Saline wash + offloading",
            "medication": "Metformin 500mg",
        },
        headers=_auth(doc_tok),
    )
    assert dv.status_code == 200
    assert dv.json()["status"] == "accepted"

    assert client.get("/api/v1/payments/my", headers=_auth(asha_tok)).json()["total_earned"] == 50.0
    assert client.get("/api/v1/payments/my", headers=_auth(mod_tok)).json()["total_earned"] == 20.0
    assert client.get("/api/v1/payments/my", headers=_auth(doc_tok)).json()["total_earned"] == 30.0

    stats = client.get("/api/v1/admin/stats", headers=_auth(adm_tok)).json()
    assert stats["accepted_count"] == 2
    assert stats["total_payouts"] == 200.0

    users = client.get("/api/v1/admin/users", headers=_auth(adm_tok)).json()["users"]
    assert len(users) >= 10

    subs = client.get("/api/v1/admin/submissions", headers=_auth(adm_tok)).json()["submissions"]
    assert len(subs) == 2
    assert all(s["photo_count"] == 3 for s in subs)

    pays = client.get("/api/v1/admin/payments", headers=_auth(adm_tok)).json()["payments"]
    assert len(pays) == 5

    # Test admin user patch, rates, and payment mark-paid
    patch = client.patch(
        "/api/v1/admin/users/MOD_MMCH_01",
        json={"district": "Kolkata"},
        headers=_auth(adm_tok),
    )
    assert patch.status_code == 200
    assert patch.json()["user"]["district"] == "Kolkata"

    rates = client.get("/api/v1/admin/rates", headers=_auth(adm_tok))
    assert rates.status_code == 200
    assert rates.json()["rates"]["doctor_direct"] == 80.0

    mark = client.post(f"/api/v1/admin/payments/{pays[0]['payment_id']}/mark-paid", headers=_auth(adm_tok))
    assert mark.status_code == 200
    assert mark.json()["payment"]["status"] == "paid"
