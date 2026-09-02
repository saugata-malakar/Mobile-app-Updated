/**
 * Consent signature fingerprint (no @noble/hashes — avoids Hermes ReferenceError in RN).
 */
export function fingerprintConsentSignature(sig: string): string {
  const payload = (sig.includes(',') ? sig.split(',')[1] ?? sig : sig).slice(0, 8000);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = (Math.imul(h2 ^ c, 0x85ebca6b) + i) >>> 0;
  }
  return `digest-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}-len${payload.length}`;
}
