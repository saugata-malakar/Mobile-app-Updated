/**
 * AES-256-GCM for photograph payloads before upload (Phase A).
 * Key: PBKDF2-HMAC-SHA256 from app secret + patient_id + device_id (spec §9 pattern).
 */
import {gcm} from '@noble/ciphers/aes.js';
import {randomBytes} from '@noble/ciphers/utils.js';
import {pbkdf2} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, hexToBytes, utf8ToBytes} from '@noble/hashes/utils.js';

const PBKDF2_ITERATIONS = 100_000;
const DK_LEN = 32;

const PHOTO_KDF_SECRET = 'healthscreen-photo-kdf-v1-dev-only';

export function derivePhotoKey(patientId: string, deviceId: string): Uint8Array {
  const salt = utf8ToBytes(`${patientId}|${deviceId}`);
  return pbkdf2(sha256, utf8ToBytes(PHOTO_KDF_SECRET), salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: DK_LEN,
  });
}

export type EncryptedPhotoBlob = {
  alg: 'AES-256-GCM';
  ivHex: string;
  ciphertextHex: string;
};

export function encryptPhotoBytes(
  plain: Uint8Array,
  patientId: string,
  deviceId: string,
): EncryptedPhotoBlob {
  const key = derivePhotoKey(patientId, deviceId);
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const sealed = cipher.encrypt(plain);
  return {
    alg: 'AES-256-GCM',
    ivHex: bytesToHex(iv),
    ciphertextHex: bytesToHex(sealed),
  };
}

export function decryptPhotoBytes(
  blob: EncryptedPhotoBlob,
  patientId: string,
  deviceId: string,
): Uint8Array {
  const key = derivePhotoKey(patientId, deviceId);
  const iv = hexToBytes(blob.ivHex);
  const data = hexToBytes(blob.ciphertextHex);
  const cipher = gcm(key, iv);
  return cipher.decrypt(data);
}
