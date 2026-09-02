# PII Field Map - All 26 Tables

**Owner:** Saugata Malakar  
**Status:** Week 1 Deliverable  
**Classification Standard:** DPDP Act 2023 + Data Protection Guidelines  
**k-anonymity Target:** ≥5 for all exports  

---

## Classification Legend

| Category | Definition | Action |
|----------|-----------|--------|
| **Direct Identifier** | Directly identifies individual (name, phone, Aadhaar, ID) | Must pseudonymise or remove from export |
| **Quasi-Identifier** | Combination can re-identify (age, village, gender, dates) | Generalise (age → 5yr bands, village → district) |
| **Non-Sensitive** | No re-identification risk | Retain as-is |

---

## Core Tables (Patient-Centric)

### 1. users
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| user_id | UUID | Direct Identifier | Pseudonymise with HMAC-SHA256 |
| email | String | Direct Identifier | Remove from export |
| phone | String | Direct Identifier | Remove from export |
| password_hash | String | Direct Identifier | Remove from export |
| role | String | Non-Sensitive | Retain (staff, doctor, asha, patient) |
| created_at | Timestamp | Non-Sensitive | Retain |
| updated_at | Timestamp | Non-Sensitive | Retain |

### 2. patients
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| patient_id | UUID | Direct Identifier | Pseudonymise with HMAC-SHA256 + rotating salt |
| name | String | Direct Identifier | Remove from export |
| phone | String | Direct Identifier | Remove from export |
| age | Integer | Quasi-Identifier | Generalise to 5-year bands (0-4, 5-9, ..., 75+) |
| gender | String | Quasi-Identifier | Retain (required for clinical context, 2 values) |
| village | String | Quasi-Identifier | Remove from export; keep district only |
| district | String | Quasi-Identifier | Retain (geographic region, not individual-specific) |
| aadhar_id | String | Direct Identifier | Remove from export |
| consent_given_at | Timestamp | Quasi-Identifier | Generalise to date (no time-of-day) |
| consent_version | Integer | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 3. patient_medical_history
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| history_id | UUID | Direct Identifier | Pseudonymise (linked to patient_id) |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt as patient) |
| hba1c | Float | Non-Sensitive | Retain (clinical value) |
| diabetes_duration_years | Integer | Quasi-Identifier | Generalise to 2-year bands |
| blood_pressure | String | Non-Sensitive | Retain (clinical value) |
| prior_foot_problems | String | Non-Sensitive | Retain |
| current_medications | String | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 4. wound_sites
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| wound_site_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| location_code | String | Non-Sensitive | Retain (left foot, right foot, etc.) |
| initial_date | Date | Quasi-Identifier | Generalise to year-month |
| created_at | Timestamp | Non-Sensitive | Retain |

### 5. monitoring_sessions
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| session_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| wound_site_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| session_date | Date | Quasi-Identifier | Generalise to year-month |
| asha_worker_id | String | Direct Identifier | Pseudonymise |
| notes | Text | Non-Sensitive | Retain (clinical text, no PHI) |
| created_at | Timestamp | Non-Sensitive | Retain |

### 6. photographs
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| photo_id | UUID | Direct Identifier | Pseudonymise |
| session_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| file_path | String | Quasi-Identifier | Remove or anonymise filename |
| file_hash | String | Non-Sensitive | Retain (for deduplication) |
| encrypted | Boolean | Non-Sensitive | Retain (must be True; audit if False) |
| taken_at | Timestamp | Quasi-Identifier | Generalise to hour (not minute) |
| created_at | Timestamp | Non-Sensitive | Retain |

### 7. ai_results
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| result_id | UUID | Direct Identifier | Pseudonymise |
| session_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| model_name | String | Non-Sensitive | Retain |
| model_version | String | Non-Sensitive | Retain |
| wagner_grade | Integer | Non-Sensitive | Retain |
| tissue_type | String | Non-Sensitive | Retain |
| infection_probability | Float | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 8. alerts
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| alert_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| severity | String | Non-Sensitive | Retain |
| message | Text | Non-Sensitive | Retain |
| acknowledged_at | Timestamp | Quasi-Identifier | Generalise to day |
| created_at | Timestamp | Non-Sensitive | Retain |

---

## ASHA Worker & Clinical Tables

### 9. asha_workers
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| worker_id | String | Direct Identifier | Pseudonymise |
| name | String | Direct Identifier | Remove from export |
| phone | String | Direct Identifier | Remove from export |
| pin_hash | String | Direct Identifier | Remove from export |
| village | String | Quasi-Identifier | Remove from export; keep district |
| district | String | Quasi-Identifier | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 10. asha_patient_assignments
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| assignment_id | UUID | Direct Identifier | Pseudonymise |
| asha_worker_id | String | Direct Identifier | Pseudonymise (same salt) |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| assigned_at | Date | Quasi-Identifier | Generalise to month |
| created_at | Timestamp | Non-Sensitive | Retain |

### 11. asha_commissions
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| commission_id | UUID | Direct Identifier | Pseudonymise |
| asha_worker_id | String | Direct Identifier | Pseudonymise (same salt) |
| amount | Float | Non-Sensitive | Retain (no PHI) |
| period | String | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 12. asha_training_modules
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| module_id | UUID | Non-Sensitive | Retain |
| name | String | Non-Sensitive | Retain |
| content | Text | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 13. doctors
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| doctor_id | UUID | Direct Identifier | Pseudonymise |
| name | String | Direct Identifier | Remove from export |
| email | String | Direct Identifier | Remove from export |
| nmc_number | String | Direct Identifier | Remove from export |
| specialisation | String | Non-Sensitive | Retain |
| languages | String | Non-Sensitive | Retain |
| fee_per_consult | Float | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 14. doctor_patient_assignments
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| assignment_id | UUID | Direct Identifier | Pseudonymise |
| doctor_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| assigned_at | Date | Quasi-Identifier | Generalise to month |
| created_at | Timestamp | Non-Sensitive | Retain |

### 15. teleconsult_requests
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| request_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| doctor_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| requested_at | Timestamp | Quasi-Identifier | Generalise to hour |
| completed_at | Timestamp | Quasi-Identifier | Generalise to hour |
| notes | Text | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

---

## Prescriptions, Subscriptions & Payments

### 16. prescriptions
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| prescription_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| doctor_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| medicine | String | Non-Sensitive | Retain |
| dosage | String | Non-Sensitive | Retain |
| duration_days | Integer | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 17. subscription_tiers
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| tier_id | UUID | Non-Sensitive | Retain |
| name | String | Non-Sensitive | Retain |
| price | Float | Non-Sensitive | Retain |
| features | String | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

### 18. subscriptions
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| subscription_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| tier_id | UUID | Non-Sensitive | Retain |
| start_date | Date | Quasi-Identifier | Generalise to month |
| end_date | Date | Quasi-Identifier | Generalise to month |
| created_at | Timestamp | Non-Sensitive | Retain |

### 19. payment_transactions
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| transaction_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| amount | Float | Non-Sensitive | Retain (no payment method stored) |
| transaction_date | Date | Quasi-Identifier | Generalise to month |
| status | String | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

---

## Session Management & Notifications

### 20. session_schedule
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| schedule_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| asha_worker_id | String | Direct Identifier | Pseudonymise (same salt) |
| scheduled_date | Date | Quasi-Identifier | Generalise to week |
| reminder_sent_at | Timestamp | Quasi-Identifier | Generalise to day |
| created_at | Timestamp | Non-Sensitive | Retain |

### 21. notifications
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| notification_id | UUID | Direct Identifier | Pseudonymise |
| user_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| message | Text | Non-Sensitive | Retain |
| read_at | Timestamp | Quasi-Identifier | Generalise to day |
| created_at | Timestamp | Non-Sensitive | Retain |

### 22. notification_preferences
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| pref_id | UUID | Direct Identifier | Pseudonymise |
| user_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| sms_enabled | Boolean | Non-Sensitive | Retain |
| email_enabled | Boolean | Non-Sensitive | Retain |
| push_enabled | Boolean | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

---

## Audit & Research Tables

### 23. audit_logs
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| log_id | UUID | Non-Sensitive | Retain (audit trail must be preserved) |
| user_id | UUID | Direct Identifier | Pseudonymise (for audit linkage) |
| action | String | Non-Sensitive | Retain |
| table_name | String | Non-Sensitive | Retain |
| record_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| timestamp | Timestamp | Non-Sensitive | Retain |

### 24. research_exports
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| export_id | UUID | Non-Sensitive | Retain |
| exported_by | UUID | Direct Identifier | Pseudonymise (for audit) |
| table_name | String | Non-Sensitive | Retain |
| row_count | Integer | Non-Sensitive | Retain |
| k_anonymity_verified | Boolean | Non-Sensitive | Retain (must be True) |
| export_date | Date | Quasi-Identifier | Generalise to month |
| created_at | Timestamp | Non-Sensitive | Retain |

### 25. consents
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| consent_id | UUID | Direct Identifier | Pseudonymise |
| patient_id | UUID | Direct Identifier | Pseudonymise (same salt) |
| consent_version | Integer | Non-Sensitive | Retain |
| data_use_category | String | Non-Sensitive | Retain |
| given_at | Date | Quasi-Identifier | Generalise to month |
| expires_at | Date | Quasi-Identifier | Generalise to month |
| created_at | Timestamp | Non-Sensitive | Retain |

### 26. app_config
| Field | Type | Classification | Action |
|-------|------|-----------------|--------|
| config_id | UUID | Non-Sensitive | Retain |
| key | String | Non-Sensitive | Retain |
| value | String | Non-Sensitive | Retain |
| created_at | Timestamp | Non-Sensitive | Retain |

---

## DPDP Act 2023 Compliance

### Data Localisation (Section 2)
✅ **Required:** All patient data stays in Mumbai (data centre location configured in `backend/config.py`)  
✅ **Action:** Enforce region check before export

### Right to Erasure (Section 8)
✅ **Required:** Patients can request deletion within 72 hours  
✅ **Action:** Erasure pipeline implemented in `backend/database/erasure.py`  
✅ **Dependency order:** Start with transactions → alerts → exports → core records

### Consent & Withdrawal
✅ **Required:** Consent versioning, withdrawal tracking  
✅ **Action:** `consents` table tracks all versions; flag patients for re-consent if data use changes

### Sensitive Personal Data (SPD)
✅ **Health data:** All wound images, AI results are SPD  
✅ **Enforcement:** AES-256-GCM encryption at rest, HTTPS-only transmission

---

## Anonymisation Strategy

### Patient ID Pseudonymisation
**Method:** HMAC-SHA256 with rotating salt (90-day rotation)
```python
pseudonym = HMAC_SHA256(patient_id + salt, key)  # Output: 64-char hex
```

### Age Generalisation  
**Bands:** 0-4, 5-9, 10-14, ..., 70-74, 75+  
**Preserves:** Clinical relevance (diabetic foot complications increase with age)

### Village Removal
**Rule:** Strip village names; keep district (geographic region for epidemiology)  
**Rationale:** Village + gender + age ≤ 5-year band = high re-identification risk

### Timestamp Generalisation
- **Sessions, photos:** Hour (YYYY-MM-DD HH:00:00)
- **Consents, dates:** Month (YYYY-MM)
- **Audit logs:** Full precision (for compliance audit)

---

## k-Anonymity Verification

For any export dataset:
1. Group by (district, age_band, gender)
2. Count records per group
3. If any group has < 5 records → REJECT export
4. If all groups ≥ 5 → Mark `k_anonymity_verified = True` in research_exports
5. Log export event with k-anonymity stamp in audit_logs

---

## File Map

| File | Purpose | Owner |
|------|---------|-------|
| `backend/database/privacy.py` | Core anonymisation logic | Saugata |
| `backend/database/erasure.py` | Patient deletion pipeline | Saugata |
| `backend/api/routers/export.py` | Data export endpoint | Saugata + Sahil |
| `backend/database/models.py` | SQLAlchemy ORM (26 tables) | Sahil (primary), Saugata (review) |
| `tests/test_anonymisation.py` | Unit tests for k-anonymity | Saugata |
| `docs/PII_FIELD_MAP.md` | This document | Saugata |

---

## Sign-Off

- [ ] PII map reviewed by PI
- [ ] Anonymisation architecture reviewed by PI (required before Week 2 coding)
- [ ] k-anonymity threshold (5) approved by ethics committee
- [ ] DPDP compliance gap analysis signed off

