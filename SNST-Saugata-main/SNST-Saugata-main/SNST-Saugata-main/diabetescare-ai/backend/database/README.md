# Database & Privacy Module (`backend/database/`)

**Leads:** Sahil Kumar Gupta (schema), Saugata Malakar (privacy, DPDP, anonymisation)

PostgreSQL schema, migrations, and **DPDP Act 2023 compliance** with anonymisation pipeline.

---

## Week 1–2 Deliverables ✓

### ✅ PII Field Map
- **File:** [docs/PII_FIELD_MAP.md](../../docs/PII_FIELD_MAP.md)
- **Status:** All 26 tables classified (direct/quasi/non-sensitive)
- **Format:** Classification table per table with anonymisation actions

### ✅ DPDP Compliance Gap Analysis
- **File:** [docs/DPDP_COMPLIANCE.md](../../docs/DPDP_COMPLIANCE.md)
- **Status:** Week-by-week roadmap, section-by-section review
- **Scope:** Data localisation, erasure, consent, encryption, breach notification

### ✅ Anonymisation Engine
- **File:** `privacy.py`
- **Features:** HMAC-SHA256 pseudonymisation, age bands, k-anonymity (k≥5), village stripping
- **Tests:** 45+ unit tests + integration tests

### ✅ Erasure Pipeline
- **File:** `erasure.py`
- **Features:** 72-hour deletion window, dependency ordering (all 26 tables), verification
- **Owner:** Saugata Malakar

### ✅ Data Export Endpoint
- **File:** `../api/routers/export.py`
- **Route:** `POST /api/v1/export`
- **Gate:** Automatic k-anonymity verification before export

### ✅ Database Models
- **File:** `models.py`
- **Format:** SQLAlchemy ORM with all 26 tables + PII annotations
- **Integration:** Works with anonymisation & erasure pipelines

---

## Quick Start

### Run Demo
```bash
python scripts/demo_week2_privacy.py
```
Demonstrates: pseudonymisation, age generalization, k-anonymity, erasure workflow.

### Run Tests
```bash
pytest tests/test_anonymisation.py -v          # Unit tests (45+)
pytest tests/test_week2_integration.py -v      # Integration tests
```

### Use Anonymisation Engine
```python
from backend.database.privacy import get_anonymisation_engine

engine = get_anonymisation_engine()

# Pseudonymise
pseudonym = engine.pseudonymise_id("pat-123")

# Anonymise record
anonymised = engine.anonymise_record("patients", {...})

# Verify k-anonymity
is_k_anon, report = engine.verify_k_anonymity(records, ["district", "age", "gender"])
```

---

## Core Tables (26 total)

### Patient-Centric (Main)
- `patients` – Demographics, consent version
- `patient_medical_history` – HbA1c, diabetes duration, medications
- `wound_sites` – Location, initial date
- `monitoring_sessions` – Wound visits, ASHA worker assignment
- `photographs` – Encrypted wound images
- `ai_results` – Wagner grade, tissue type, infection probability
- `alerts` – Severity, acknowledgment status

### ASHA & Clinical
- `asha_workers` – Field workers (name, phone, village)
- `asha_patient_assignments` – Who visits whom
- `asha_commissions` – Payment records
- `asha_training_modules` – Training content
- `doctors` – Clinician metadata
- `doctor_patient_assignments` – Doctor assignments

### Consultations & Prescriptions
- `teleconsult_requests` – Video visit requests
- `prescriptions` – Medicine, dosage, duration

### Subscriptions & Payments
- `subscription_tiers` – Plan types
- `subscriptions` – Active plans
- `payment_transactions` – Payment history

### Sessions & Notifications
- `session_schedule` – Upcoming visits
- `notifications` – App notifications
- `notification_preferences` – Opt-in/out

### Audit & Research
- `audit_logs` – Every read, write, delete, login (7-year retention)
- `research_exports` – Anonymised exports (k-anonymity verified)
- `consents` – Versioned consent records

### Config
- `app_config` – System configuration

---

## PII Classification Strategy

| Sensitivity | Definition | Action on Export |
|------------|-----------|------------------|
| **Direct ID** | Name, phone, Aadhaar, email | ✗ REMOVE |
| **Quasi-ID** | Age, village, date, gender | ⚠ GENERALISE |
| **Non-Sensitive** | Clinical values, district, model output | ✓ RETAIN |

### Generalisation Rules

**Age:** 5-year bands (0-4, 5-9, ..., 75+)  
**Duration:** 2-year bands (0-1, 2-3, 4-5 years)  
**Village:** Removed; keep district (epidemiology)  
**Timestamps:**
- Photos, consults → Hour (YYYY-MM-DD HH:00)
- Dates → Month (YYYY-MM)
- Audit logs → Full precision

---

## k-Anonymity Verification (k ≥ 5)

**Requirement:** No record should be uniquely re-identifiable.

**Method:**
1. Group records by quasi-identifiers (district, age, gender)
2. Count records per group
3. If any group < 5 → **REJECT export**
4. If all groups ≥ 5 → **APPROVE + audit log**

**Example:**
```
District: Paschim Medinipur, Age: 40-44, Gender: Male → 12 records ✓
District: Jhargram, Age: 75+, Gender: Female → 2 records ✗ REJECT

Result: Export blocked (1 violation)
```

---

## Erasure Pipeline (72-hour window)

**Deletion Order** (respecting foreign keys):
1. Transactions, commissions (leaf nodes)
2. Session artifacts (photos, AI results, alerts, notifications)
3. Core sessions, consents, subscriptions
4. Assignments (ASHA, doctor)
5. Patient demographics

**Verification:** Query all 26 tables; confirm 0 records remain.

**Audit Trail:** Erasure logged with timestamp (irreversible).

---

## Data Export Endpoint

**Request:**
```json
{
  "table": "patients",
  "district": "Paschim Medinipur",
  "age_min": 30,
  "age_max": 70,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "dry_run": false
}
```

**Response (if k-anon verified):**
```json
{
  "export_id": "export_abc123",
  "k_anonymity": {
    "is_k_anonymous": true,
    "violations": 0,
    "smallest_group_size": 12
  },
  "data": [...],
  "exported_at": "2024-11-15T14:32:00Z"
}
```

**Response (if k-anon NOT verified):**
```json
{
  "status": "rejected",
  "reason": "k-anonymity threshold not met",
  "violations": 3
}
```

---

## Tools & Frameworks

- **SQLAlchemy 2.x** ORM (models.py)
- **Pydantic** (request/response models)
- **FastAPI** (export endpoint)
- **pytest** (45+ test cases)
- **HMAC-SHA256** (pseudonymisation)

---

## Files

```
backend/database/
├── privacy.py                    # AnonymisationEngine + RotatingSaltManager
├── erasure.py                    # ErasurePipeline + ErasureScheduler
├── models.py                     # 26 SQLAlchemy ORM tables
└── README.md                     # This file

backend/api/routers/
└── export.py                     # POST /api/v1/export endpoint

docs/
├── PII_FIELD_MAP.md              # All 26 tables classified
└── DPDP_COMPLIANCE.md            # Compliance roadmap

tests/
├── test_anonymisation.py         # 45+ unit tests
└── test_week2_integration.py     # End-to-end tests

scripts/
└── demo_week2_privacy.py         # Runnable demo
```

---

## Next Steps (Week 3–6)

- **Week 3:** Federated Learning PoC (Flower, data stays on node)
- **Week 4:** Multimodal AI (Gemini Vision) + Clinical NLP (spaCy)
- **Week 5:** RAG Assistant + Consent Versioning
- **Week 6:** Encryption Audit + OWASP Checklist + Privacy Impact Assessment

---

## DPDP Act 2023 Compliance Checklist

| Requirement | Status | File |
|-------------|--------|------|
| Data localisation (Mumbai only) | ⚠ Policy defined | [DPDP_COMPLIANCE.md](../../docs/DPDP_COMPLIANCE.md) |
| Right to erasure (72-hour window) | ✓ Implemented | erasure.py |
| Anonymisation (k≥5) | ✓ Implemented | privacy.py |
| Encryption (AES-256-GCM) | ⬜ Week 6 | Pending |
| Audit trail | ✓ Designed | export.py |
| Consent versioning | ⬜ Week 5 | Pending |
| Privacy Impact Assessment | ⬜ Week 6 | Pending |
