from models import Consultation, Doctor, db


def _matches_specialisation(condition_type: str, spec: str | None) -> bool:
    s = (spec or "").lower()
    if condition_type == "skin":
        return "dermatologist" in s or "general physician" in s or "physician" in s
    if condition_type == "eye":
        return "ophthalmologist" in s or "general physician" in s or "physician" in s
    if condition_type == "wound":
        return "general physician" in s or "physician" in s
    return False


def find_available_doctor(condition_type: str, mode: str) -> Doctor | None:
    _ = mode
    q = (
        Doctor.query.filter(Doctor.active.is_(True))
        .filter(Doctor.cases_today < Doctor.max_cases_per_day)
        .order_by(Doctor.cases_today.asc())
    )
    for doc in q.all():
        if _matches_specialisation(condition_type, doc.specialisation):
            return doc
    return None


def calculate_queue_position() -> int:
    pending = Consultation.query.filter(Consultation.status == "pending").count()
    return pending + 1


def calculate_wait_time(queue_position: int, mode: str) -> int:
    if mode == "async":
        return int(queue_position) * 240
    if mode == "scheduled":
        return 0
    if mode == "instant":
        return int(queue_position) * 15
    return 0
