# OWASP Top 10 API Security Checklist & Audit Report
**DiabetesCare AI Compliance Review**

---

## Executive Summary

A comprehensive security audit of the FastAPI application was conducted against the **OWASP Top 10 API Security Risks (2023)**. This checklist documents findings, identifies gaps, and outlines mitigation strategies for the production release.

---

## OWASP API Risk Checklist

### 1. API1:2023 - Broken Object Level Authorization (BOLA)
*   **Description**: Attackers can access or manipulate records belonging to other users by changing IDs in the request URL.
*   **Audit Finding**: Protected endpoints check user scope. For example, `get_screening` verifies `s.patient_id == p.patient_id` and rejects unauthorized patient requests with a `403 Forbidden` error.
*   **Gap Documented**: Low. Ensure all future routers verify ownership dynamically before executing queries.
*   **Remediation**: Establish a decorator or database filter pattern to inject automatic tenancy/ownership checks.

### 2. API2:2023 - Broken Authentication
*   **Description**: Flaws in token validation, password hashing, or PIN verification.
*   **Audit Finding**: User passwords are encrypted using `bcrypt` (salted). JWT access tokens are signed using HMAC-SHA256 and verified using a strict payload schema (`TokenPayload`). Session lifetimes are capped at 24 hours.
*   **Gap Documented**: ASHA worker PINs are stored securely via `bcrypt`, but there is no account lockout policy for brute-force attacks on PINs.
*   **Remediation**: Implement a rate-limiter / lock-out database flag that blocks an account for 1 hour after 5 failed authentication attempts.

### 3. API3:2023 - Broken Object Property Level Authorization (BOPLA)
*   **Description**: Attackers modify properties they shouldn't (e.g. self-escalating role to `admin`).
*   **Audit Finding**: Write endpoints use strict input sanitization. The profile update endpoint (`PUT /api/v1/patients/me`) only unpacks and saves specific, safe parameters (`known_conditions`, `allergies`, `abha_id`, `district`), completely ignoring other incoming JSON properties.
*   **Gap Documented**: None. Pydantic models validate request schemas.
*   **Remediation**: Standardize on Pydantic request models with `extra = Extra.forbid` (or `extra = "forbid"` in V2) to reject unexpected fields.

### 4. API4:2023 - Unrestricted Resource Consumption
*   **Description**: Denial of Service (DoS) via resource depletion (memory, CPU, disk storage).
*   **Audit Finding**: Image upload sizes are checked (`MAX_UPLOAD_SIZE_MB = 50`), and database queries are paginated by default.
*   **Gap Documented**: **HIGH**. There is no API-wide rate limiting (requests per second) or client IP throttling. An attacker could flood the GPU/CPU intensive multimodal AI inference endpoints.
*   **Remediation**: Integrate `slowapi` or equivalent rate-limiting middleware in FastAPI (e.g. 5 inference requests per minute per user).

### 5. API5:2023 - Broken Function Level Authorization (BFLA)
*   **Description**: Non-admin users executing administrative operations.
*   **Audit Finding**: Sensitive functions check roles. For instance, the reset PIN route `/asha/reset-pin` extracts and verifies `payload.user_type == "admin"` before modifying ASHA worker credentials.
*   **Gap Documented**: None. Authentication middleware validates role claims in the JWT payload.
*   **Remediation**: Conduct automated regression tests checking that doctor, patient, and ASHA roles receive `403 Forbidden` on admin routes.

### 6. API6:2023 - Unrestricted Access to Sensitive Business Flows
*   **Description**: Attackers automate flows, sending too many SMS codes or payment sync operations.
*   **Audit Finding**: Razorpay transaction endpoints are registered but lack transactional velocity checks.
*   **Gap Documented**: Potential abuse of registration flows or payment verification loops.
*   **Remediation**: Add Captcha or device verification checks for new account registrations.

### 7. API7:2023 - Server Side Request Forgery (SSRF)
*   **Description**: The API can be forced to retrieve external third-party resources.
*   **Audit Finding**: The API does not accept arbitrary external URLs to fetch images. All images are uploaded directly as raw base64 or multipart form file binaries.
*   **Gap Documented**: None.
*   **Remediation**: Maintain strict input validation restricting remote URL retrieval.

### 8. API8:2023 - Security Misconfiguration
*   **Description**: Missing CORS protection, default secret keys, or debug stack traces.
*   **Audit Finding**: CORS origins are configured dynamically. FastAPIs debug mode is controlled by an environment variable.
*   **Gap Documented**: **MEDIUM**. Standard HTTP security headers (e.g. `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`) are not explicitly set by FastAPI.
*   **Remediation**: Add a middleware that injects recommended secure response headers (HSTS, CSP, and clickjacking protection).

### 9. API9:2023 - Improper Inventory Management
*   **Description**: Deprecated API versions or staging backdoors exposed.
*   **Audit Finding**: Clean version separation (`/api/v1/`).
*   **Gap Documented**: Legacy Flask router files remain in the `backend/legacy` directory. Although they are not imported or registered by FastAPI, their presence in the codebase is a security hygiene risk.
*   **Remediation**: Clean up and archive `backend/legacy` files prior to final containerization.

### 10. API10:2023 - Unsafe Consumption of APIs
*   **Description**: Blindly trusting outputs from external third-party services.
*   **Audit Finding**: The multimodal AI router falls back to Google Gemini APIs. The responses are parsed within `try...except` blocks with type checks.
*   **Gap Documented**: If Gemini returns unstructured JSON, we parse it using custom parsing functions which could fail if schema structures drift.
*   **Remediation**: Standardize Gemini calls to use Structured Outputs (defining response schemas in the Gemini API configuration).
