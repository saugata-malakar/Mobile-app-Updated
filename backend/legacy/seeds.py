import bcrypt
import json

from dotenv import load_dotenv

load_dotenv()

from app import create_app
from models import Admin, AshaWorker, Doctor, Patient, db


def run():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        admin_pw = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
        db.session.add(
            Admin(
                name="Admin User",
                email="admin@healthscreen.app",
                password_hash=admin_pw,
                role="admin",
                active=True,
            )
        )

        doc_pw = bcrypt.hashpw(b"doctor123", bcrypt.gensalt()).decode("utf-8")
        availability = {
            "mon": "09:00-17:00",
            "tue": "09:00-17:00",
            "wed": "09:00-17:00",
            "thu": "09:00-17:00",
            "fri": "09:00-17:00",
            "sat": "09:00-17:00",
        }
        db.session.add(
            Doctor(
                name="Dr. Debashish Sharma",
                email="sharma@healthscreen.app",
                password_hash=doc_pw,
                nmc_number="NMC001234",
                specialisation="General Physician",
                languages="Bengali,Hindi,English",
                availability=json.dumps(availability),
            )
        )
        db.session.add(
            Doctor(
                name="Dr. Ananya Roy",
                email="roy@healthscreen.app",
                password_hash=doc_pw,
                nmc_number="NMC005678",
                specialisation="Dermatologist",
                languages="Bengali,English",
            )
        )
        db.session.add(
            Doctor(
                name="Dr. Suresh Patel",
                email="patel@healthscreen.app",
                password_hash=doc_pw,
                nmc_number="NMC009012",
                specialisation="Ophthalmologist",
                languages="Hindi,English",
            )
        )

        pin_hash = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode("utf-8")
        db.session.add(
            AshaWorker(
                worker_id="asha001",
                name="Meena Devi",
                phone="9876543210",
                pin_hash=pin_hash,
                village="Jhargram",
                district="Jhargram",
            )
        )
        db.session.add(
            AshaWorker(
                worker_id="asha002",
                name="Rekha Roy",
                phone="9876543211",
                pin_hash=pin_hash,
                village="Midnapore",
                district="Paschim Medinipur",
            )
        )

        from datetime import datetime, timezone

        db.session.add(
            Patient(
                name="Test Patient",
                phone="9000000000",
                age=35,
                gender="Male",
                village="Kharagpur",
                district="Paschim Medinipur",
                consent_given_at=datetime.now(timezone.utc),
            )
        )

        db.session.commit()
        print("Seed complete.")


if __name__ == "__main__":
    run()
