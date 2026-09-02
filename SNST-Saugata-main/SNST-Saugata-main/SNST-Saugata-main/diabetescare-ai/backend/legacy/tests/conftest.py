import os

os.environ["FLASK_ENV"] = "testing"
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key")

import pytest

from app import app as flask_app
from models import Admin, AshaWorker, Doctor, Patient, db


@pytest.fixture
def app():
    with flask_app.app_context():
        db.drop_all()
        db.create_all()
        from migrations.seed_phase_a import ensure_phase_a_seed

        ensure_phase_a_seed()
        from migrations.upgrade_subscription_d1 import upgrade_subscription_d1

        upgrade_subscription_d1()
    yield flask_app
    with flask_app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def sample_patient(app):
    with app.app_context():
        p = Patient(
            name="P One",
            phone="9111111111",
            age=30,
            gender="Male",
            village="V1",
            consent_given_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        )
        db.session.add(p)
        db.session.flush()
        from subscription_service import ensure_trial_subscription

        ensure_trial_subscription(p.id)
        db.session.commit()
        return p.id


@pytest.fixture
def sample_asha(app):
    import bcrypt

    with app.app_context():
        w = AshaWorker(
            worker_id="asha_test",
            name="Asha T",
            phone="9222222222",
            pin_hash=bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode("utf-8"),
            village="V2",
            active=True,
        )
        db.session.add(w)
        db.session.commit()
        return w.id


@pytest.fixture
def sample_doctor(app):
    import bcrypt

    with app.app_context():
        d = Doctor(
            name="Doc T",
            email="doc_t@example.com",
            password_hash=bcrypt.hashpw(b"x", bcrypt.gensalt()).decode("utf-8"),
            nmc_number="NMC999",
            specialisation="General Physician",
            active=True,
        )
        db.session.add(d)
        db.session.commit()
        return d.id


@pytest.fixture
def admin_user(app):
    import bcrypt

    with app.app_context():
        a = Admin(
            name="Admin T",
            email="admin_t@example.com",
            password_hash=bcrypt.hashpw(b"adminpass", bcrypt.gensalt()).decode("utf-8"),
            active=True,
        )
        db.session.add(a)
        db.session.commit()
        return a.id
