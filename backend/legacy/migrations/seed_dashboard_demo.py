"""Add demo patients + alerts for doctor@demo.in (does not wipe DB)."""
import uuid
from datetime import datetime, timezone

from models import Alert, Doctor, DoctorPatientAssignment, Patient, db


def ensure_dashboard_demo():
    from migrations.upgrade_patients_phase_a import upgrade_patients_phase_a

    upgrade_patients_phase_a()

    email = "doctor@demo.in"
    doc = Doctor.query.filter(db.func.lower(Doctor.email) == email).first()
    if not doc:
        print("Demo doctor not found — start Flask once so ensure_demo_doctor() runs.")
        return

    demos = [
        ("Ramesh Mondal", "9876501001", "Jhargram", 58, "RED"),
        ("Sita Devi", "9876501002", "Binpur", 52, "AMBER"),
        ("Anil Das", "9876501003", "Gopiballavpur", 61, "GREEN"),
    ]
    created = 0
    for name, phone, village, age, level in demos:
        p = Patient.query.filter_by(phone=phone).first()
        if not p:
            p = Patient(
                id=str(uuid.uuid4()),
                name=name,
                phone=phone,
                age=age,
                gender="Male" if "Devi" not in name else "Female",
                village=village,
                is_research_participant=True,
            )
            db.session.add(p)
            db.session.flush()
            created += 1

        if not DoctorPatientAssignment.query.filter_by(
            doctor_id=doc.id, patient_id=p.id, is_active=True
        ).first():
            db.session.add(
                DoctorPatientAssignment(
                    doctor_id=doc.id,
                    patient_id=p.id,
                    assignment_type="PRIMARY",
                    is_active=True,
                )
            )

        open_alert = (
            Alert.query.filter_by(patient_id=p.id)
            .filter(Alert.resolved_at.is_(None))
            .first()
        )
        if not open_alert:
            db.session.add(
                Alert(
                    patient_id=p.id,
                    alert_level=level,
                    alert_type="wound_monitoring",
                    message_doctor_en=f"{name}: wound follow-up — demo alert ({level}).",
                    message_patient_en="Please contact your ASHA worker.",
                    generated_at=datetime.now(timezone.utc),
                )
            )

    db.session.commit()
    print(f"Dashboard demo ready for {email}: {created} new patient(s), assignments + alerts.")
