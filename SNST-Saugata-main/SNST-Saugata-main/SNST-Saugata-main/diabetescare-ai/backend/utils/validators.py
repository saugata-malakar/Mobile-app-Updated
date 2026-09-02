import json
import re
import bleach

def validate_phone(phone: str) -> bool:
    if not phone or not isinstance(phone, str):
        return False
    return bool(re.fullmatch(r"\d{10}", phone))


def validate_age(age) -> bool:
    try:
        a = int(age)
    except (TypeError, ValueError):
        return False
    return 1 <= a <= 120


def validate_gender(gender: str) -> bool:
    return gender in ("Male", "Female", "Other")


def sanitise_string(text: str | None) -> str:
    if text is None:
        return ""
    cleaned = bleach.clean(text, tags=[], strip=True)
    return cleaned.strip()


def validate_condition_type(condition: str) -> bool:
    return condition in ("skin", "eye", "wound")


def validate_risk_level(risk: str) -> bool:
    return risk in ("low", "medium", "high")


def validate_consultation_mode(mode: str) -> bool:
    return mode in ("async", "scheduled", "instant")


def parse_json_object(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return None
