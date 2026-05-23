"""Demo doctor account for web dashboard (dev only)."""
import uuid

import bcrypt

from models import Doctor, db


def ensure_demo_doctor():
    email = "doctor@demo.in"
    if Doctor.query.filter(db.func.lower(Doctor.email) == email).first():
        return
    pwd = bcrypt.hashpw(b"doctor123", bcrypt.gensalt()).decode("utf-8")
    doc = Doctor(
        id=str(uuid.uuid4()),
        name="Dr. Ananya Sen",
        email=email,
        password_hash=pwd,
        nmc_number="WB-DEMO-001",
        specialisation="Diabetology",
        hospital_name="IIT KGP Rural Health Demo",
        hospital_department="Endocrinology & Wound Care",
        consultation_phone="+91-98001234",
        languages="English,Bengali,Hindi",
        active=True,
        rating=4.8,
    )
    db.session.add(doc)
    db.session.commit()
