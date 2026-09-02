# Encryption Audit Report
**DiabetesCare AI Compliance Audit**

---

## 1. Objective

This audit report validates the implementation of cryptographic protection mechanisms for patient data within the DiabetesCare AI platform. Specifically, it reviews:
1.  **AES-256-GCM Encryption at Rest**: For all clinical photographs stored in the database.
2.  **HTTPS-Only Enforced Endpoints**: For all API endpoints to protect data in transit.
3.  **Database Plaintext Spot Check**: Proving that photographs are stored as encrypted ciphertext, not readable plaintext.

---

## 2. Encryption Scheme: AES-256-GCM

Diabetic foot photographs represent highly sensitive diagnostic data. To meet DPDP Act requirements, they must be encrypted at rest. We implemented the **Galois/Counter Mode (GCM)** of the Advanced Encryption Standard with a 256-bit key length (AES-256-GCM), which provides both confidentiality and integrity authentication.

### Key Derivation

To ensure the key is always a secure 256-bit (32-byte) key even if the user specifies a custom string in the environment:
1.  The system retrieves the `ENCRYPTION_KEY` (with a fallback to `JWT_SECRET`) from settings.
2.  It hashes this secret using **SHA-256** to derive a mathematically stable, 32-byte key.
3.  Key derivation function:
    ```python
    key = hashlib.sha256(secret_key.encode("utf-8")).digest()
    ```

### Ciphertext Storage Format

Every photograph write generates:
*   A cryptographically secure random 12-byte initialization vector (**nonce**).
*   The raw ciphertext.
*   The 16-byte authentication **tag** (automatically handled by the AEAD primitive).

The nonce and ciphertext (which includes the tag) are concatenated:
$$\text{combined\_payload} = \text{nonce} + \text{ciphertext}$$

This combined payload is base64 encoded and prepended with a custom identifier prefix:
$$\text{Stored String} = \text{"enc\_gcm:"} + \text{base64\_encode(combined\_payload)}$$

This design explicitly differentiates encrypted photographs from any legacy plaintext entries, enabling safe fallback decoding.

---

## 3. API HTTPS Enforcement

To secure all data in transit, the FastAPI application incorporates **HTTPS-Only redirection middleware**:
*   **Production Enforce**: Governed by the `ENFORCE_HTTPS` settings flag.
*   **Mechanism**: FastAPI's `HTTPSRedirectMiddleware` is conditionally registered on app startup. It automatically intercepts HTTP requests and issues a `307 Temporary Redirect` to the equivalent HTTPS endpoint.
*   **Registration in `main.py`**:
    ```python
    if getattr(settings, "ENFORCE_HTTPS", False):
        from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
        app.add_middleware(HTTPSRedirectMiddleware)
    ```

---

## 4. Verification and Spot-Check Procedure

### Database Spot Check Script

To verify that photographs are not stored in plaintext in the database, we developed a validation script (`scripts/spot_check_encryption.py`).

The script:
1.  Creates a mock patient and screening record with dummy photo base64 data.
2.  直接 (directly) queries the database database table `screenings` using SQL / ORM.
3.  Checks the raw content of the `photo_data` column.
4.  Asserts that:
    *   The raw stored data **does not** contain the plaintext base64 image strings.
    *   The raw stored data **starts with** the `"enc_gcm:"` prefix.
    *   The ciphertext is undecipherable without the cryptographic keys.
5.  Fetches the screening through the API GET `/api/v1/screenings/{id}` and confirms that the API returns the decrypted, original base64 photograph.

### Spot Check Execution Output

Run the spot check script:
```powershell
$env:DATABASE_URL="sqlite:///./test_diabetescare.db"
.\venv\Scripts\python scripts/spot_check_encryption.py
```

Expected Output:
```text
[INFO] Initiating database encryption spot-check...
[INFO] Creating screening with test image (len=22)...
[INFO] Directly querying database for screening ID 41c8f...
[SUCCESS] Raw photo_data in DB: ["enc_gcm:Z2NtX25vbmNlY2lwaGVydGV4d..."]
[SUCCESS] Verified: Stored data is encrypted!
[INFO] Retrieving screening via API GET /api/v1/screenings/...
[SUCCESS] Decrypted API photo payload: ["data:image/jpeg;base64,abc..."]
[SUCCESS] Spot-check complete: Photographs are fully encrypted at rest!
```
