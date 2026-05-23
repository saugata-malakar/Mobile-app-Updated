import base64
import binascii
import io
import json

from PIL import Image


def compress_base64_photo(base64_string: str) -> str:
    if not base64_string or not isinstance(base64_string, str):
        return base64_string
    raw = base64_string.split(",", 1)[-1].strip()
    try:
        data = base64.b64decode(raw, validate=False)
    except (binascii.Error, ValueError):
        return base64_string
    if len(data) < 50_000:
        return raw
    try:
        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
        img.thumbnail((800, 800))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75, optimize=True)
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return raw


def validate_photo_data(photos_list) -> bool:
    if photos_list is None:
        return True
    if not isinstance(photos_list, list):
        return False
    if len(photos_list) > 3:
        return False
    for item in photos_list:
        if not isinstance(item, str):
            return False
        raw = item.split(",", 1)[-1].strip()
        try:
            base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError):
            return False
    return True


def photos_to_json_string(photos_list: list[str] | None) -> str | None:
    if not photos_list:
        return None
    return json.dumps(photos_list)
