import base64
import binascii
import io
import json
import hashlib
import os

from PIL import Image
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


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


def get_encryption_key() -> bytes:
    from backend.utils.config import settings
    # Hash ENCRYPTION_KEY or JWT_SECRET to derive a stable 256-bit key
    key_source = getattr(settings, "ENCRYPTION_KEY", None) or getattr(settings, "JWT_SECRET", "fallback-secret-key")
    return hashlib.sha256(key_source.encode("utf-8")).digest()


def encrypt_photo_data(base64_str: str) -> str:
    if not base64_str:
        return base64_str
    try:
        key = get_encryption_key()
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ct = aesgcm.encrypt(nonce, base64_str.encode("utf-8"), None)
        # Store nonce + ciphertext combined
        combined = nonce + ct
        # Return as url-safe base64 string with a custom prefix to identify it as encrypted
        return "enc_gcm:" + base64.b64encode(combined).decode("utf-8")
    except Exception as e:
        raise ValueError(f"Encryption failed: {str(e)}")


def decrypt_photo_data(encrypted_str: str) -> str:
    if not encrypted_str:
        return encrypted_str
    if not encrypted_str.startswith("enc_gcm:"):
        # Legacy/fallback check: return plain text if not encrypted
        return encrypted_str
    try:
        raw_b64 = encrypted_str.split("enc_gcm:", 1)[-1]
        combined = base64.b64decode(raw_b64.encode("utf-8"))
        if len(combined) < 12:
            raise ValueError("Invalid encrypted package length")
        nonce = combined[:12]
        ct = combined[12:]
        key = get_encryption_key()
        aesgcm = AESGCM(key)
        decrypted_bytes = aesgcm.decrypt(nonce, ct, None)
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        # Fallback to returning original string to prevent crash in edge cases
        return encrypted_str

