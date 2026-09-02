# DPDP Act 2023 Compliance Gap Analysis

**Owner:** Saugata Malakar  
**Status:** Week 1 Deliverable  
**Review Status:** ⬜ Pending PI review  
**Last Updated:** 2024-11-15

---

## Executive Summary

This document reviews DiabetesCare AI platform compliance against the **Digital Personal Data Protection (DPDP) Act 2023** and the **DPDP Rules 2025 (MeitY draft)**. Three non-negotiable requirements are identified as must-have before production deployment:

1. **Data Localisation (Section 2(k)):** All patient data remains in Mumbai data centre
2. **Right to Erasure (Section 8):** Patients can request deletion within 72-hour window
3. **Consent & Sensitive Data:** Raw patient images leave platform only after AI processing (encrypted export only)

**Current Status:** ⚠️ **NOT COMPLIANT** (Anonymisation module, Erasure pipeline, and Encryption audit required before go-live)

---

## 1. Applicability to DiabetesCare

| Aspect | Applicability | Note |
|--------|---------------|------|
| **Personal Data** | ✅ YES | Patient names, phone, Aadhaar, medical history |
| **Sensitive Personal Data (SPD)** | ✅ YES | Health data, biometrics (wound photos) |
| **Data Fiduciary** | ✅ YES | IIT KGP (as research principal) |
| **Data Processor** | ✅ YES | Our backend (processes on behalf of IIT) |
| **Data Principal** | ✅ YES | Patients (consent required) |
| **Jurisdiction** | ✅ YES | Operations in India (Mumbai data centre) |

**Conclusion:** DPDP Act fully applies. No exemptions claimed.

---

## 2. Compliance Requirements by Section

### Section 1: Definitions
✅ **COMPLIANT**  
- Platform operates within India
- Personal data is clearly defined (name, phone, medical record)
- Sensitive data properly identified (photos, health records)

### Section 2(k): Data Localisation
🔴 **NON-COMPLIANT** → Requires implementation

**Requirement:**  
Sensitive personal data of data principals who are residents of India shall not be transferred outside India.

**Current State:**
- Data centre location: TBD (not yet deployed)
- Cloud provider: Not yet selected
- Backup strategy: Not yet defined

**Gap:**
- No documented data residency policy
- No verification that backups stay in-region
- No process for enforcing regional data location

**Required Actions (Week 1):**
1. ✅ Document policy: "All patient data encrypted and stored exclusively on Indian data centres (Mumbai region)"
2. ✅ Select cloud provider with India-only hosting (AWS Mumbai, Azure South India, or GCP Mumbai)
3. ✅ Add configuration check in deployment pipeline: `assert db_region == "ap-south-1"`
4. ⬜ Verify backup strategy enforces regional storage

**Timeline:** Complete before Week 2 coding starts  
**Owner:** Shivraj (deployment) + Saugata (policy)

---

### Section 2(a): Purpose Limitation
⚠️ **PARTIALLY COMPLIANT** → Consent versioning required

**Requirement:**  
Personal data shall be collected and processed only for specified, explicit, and lawful purposes.

**Current State:**
- Two data use categories defined: "clinical care" and "research"
- Consent form exists but versioning not tracked

**Gap:**
- No consent versioning: if data use changes, can't flag patients for re-consent
- No "withdrawal of consent" mechanism
- No audit trail of what each patient consented to

**Required Actions (Week 5):**
1. ✅ Implement `consent_versions` table tracking each version + effective date
2. ✅ Add `consent_withdrawal` endpoint
3. ✅ Flag patients for re-consent if data use category changes
4. ✅ Log consent events to audit_logs

**Timeline:** Complete by Week 5  
**Owner:** Saugata

---

### Section 5: Collection Standards
⚠️ **PARTIALLY COMPLIANT** → Transparency notice required

**Requirement:**  
Consent must be free, specific, informed, and unreserved. Must provide prescribed information.

**Current State:**
- Consent form collects medical data verbally (ASHA workers)
- No documented transparency notice

**Gap:**
- No written, plain-language transparency notice
- No proof that patients understood what data is collected
- No record of consent (date, version, signature)

**Required Actions (Week 1):**
1. ✅ Write plain-language transparency notice (2 languages: English + local)
2. ✅ Include: what data is collected, why, who has access, retention period, rights
3. ✅ Digital signature or thumbprint on consent form
4. ✅ Store consent_record with timestamp and version

**Timeline:** Complete by Week 1  
**Owner:** Saugata (with translation support)

---

### Section 8: Right to Erasure
🔴 **NON-COMPLIANT** → Erasure pipeline critical

**Requirement:**  
A data principal may request the data fiduciary to erase personal data if the purpose of processing is fulfilled or consent is withdrawn. Erasure must be completed within 30 days (or urgently if child data). Exceptions: legal obligation, active litigation.

**Current State:**
- No erasure mechanism
- No audit of what data exists per patient
- Deletion order not defined

**Gap:**
- Cannot delete patient on request
- No 72-hour urgent deletion path
- No verification that all data was deleted
- 26 tables with foreign keys; deletion order unclear

**Required Actions (Week 2):**
1. ✅ Build `ErasurePipeline` with correct dependency order (done in privacy.py)
2. ✅ Create API endpoint: POST `/api/v1/patients/{id}/request-erasure`
3. ✅ Implement 72-hour window enforcement
4. ✅ Verify deletion with query: check all 26 tables for remaining records
5. ✅ Log erasure to audit_logs with "erasure_completed" action

**Timeline:** Complete by Week 2  
**Owner:** Saugata (deletion logic) + Sahil (API endpoint)

---

### Section 6: Sensitive Personal Data (SPD)
🔴 **NON-COMPLIANT** → Encryption + anonymisation required

**Requirement:**  
Sensitive personal data (health, biometric) can only be processed with explicit, informed consent and by additional safeguards (encryption, anonymisation).

**Current State:**
- Patient photos stored (encryption status unknown)
- Health records in database (no baseline encryption)
- No anonymisation pipeline

**Gap:**
- No evidence photos are AES-256-GCM encrypted
- No encryption key rotation
- No anonymisation for research exports

**Required Actions:**
1. ✅ **Week 1:** Audit all image storage locations; confirm AES-256-GCM encryption
2. ✅ **Week 1:** Add to deployment config: enforce TLS 1.2+ for all API calls
3. ✅ **Week 2:** Build anonymisation module (done in privacy.py)
4. ✅ **Week 2:** Integrate anonymisation into data export path
5. ⬜ **Week 6:** Run encryption audit; spot-check photos in database

**Timeline:** Phase 1 (encryption audit) by Week 1; Phase 2 (anonymisation) by Week 2; Phase 3 (verification) by Week 6  
**Owner:** Saugata (privacy), Shivraj (deployment), Sahil (database)

---

### Section 7: Data Processor Responsibility
⚠️ **PARTIALLY COMPLIANT** → Contracts required

**Requirement:**  
If our backend is a "data processor" (processes on behalf of data fiduciary = IIT KGP), must have written contract with fiduciary defining processing obligations.

**Current State:**
- Data processor contract: Not in repo
- Sub-processor arrangements (AWS, cloud vendor): Not documented

**Gap:**
- No data processing agreement with IIT KGP
- No clause on sub-processors (cloud vendor)
- No audit rights documented

**Required Actions:**
1. ⬜ Draft Data Processing Agreement (DPA) with IIT KGP
2. ⬜ Include: scope, duration, nature of processing, security obligations, audit rights
3. ⬜ Document cloud vendor as sub-processor

**Timeline:** Complete before production deployment  
**Owner:** Prof. Dipak (legal), Saugata (technical clauses)

---

### Section 9: Data Breach Notification
⚠️ **PARTIALLY COMPLIANT** → Incident response plan required

**Requirement:**  
If personal data is breached (unauthorised access), notify data principal within 72 hours.

**Current State:**
- No incident response plan
- No breach log or notification template
- No communication channel to patients

**Gap:**
- No definition of "breach" (e.g., photo exfiltration vs. metadata leak)
- No escalation path
- No template for breach notification

**Required Actions:**
1. ⬜ Define breach scenarios and severity levels
2. ⬜ Create incident response playbook (60 min detection, 72 hr notification)
3. ⬜ Set up breach notification email template
4. ⬜ Ensure contact info (phone, email) is updated in patient records

**Timeline:** Complete before Week 3  
**Owner:** Saugata + Shivraj (incident response)

---

### Section 10: Data Retention & Erasure
⚠️ **PARTIALLY COMPLIANT** → Retention policy required

**Requirement:**  
Personal data shall not be retained for longer than necessary to fulfill the purpose.

**Current State:**
- Retention period: Not defined
- Deletion schedule: Not set
- Archive process: Not documented

**Gap:**
- Clinical data: How long to keep? (e.g., 7 years for medical records standard in India)
- Research data: Can it be retained indefinitely if anonymised?
- When to move old data to archive/cold storage?

**Required Actions:**
1. ✅ Define retention schedule: clinical (7 years), research (anonymised indefinitely), audit (7 years)
2. ✅ Automate deletion: cold records older than 7 years → erasure pipeline
3. ✅ Archive process: before deletion, export to research_exports (anonymised, k-anon verified)

**Timeline:** Complete by Week 5  
**Owner:** Saugata

---

### Section 12: Consent Management
⚠️ **PARTIALLY COMPLIANT** → Withdrawal & versioning required

**Requirement:**  
Data principal has right to withdraw consent anytime. Withdrawal should not affect legality of processing before withdrawal.

**Current State:**
- Consent given during enrollment (one-time)
- No withdrawal mechanism

**Gap:**
- No "withdraw consent" button in app
- No process to honor withdrawal retroactively

**Required Actions:**
1. ⬜ Add `POST /api/v1/patients/{id}/withdraw-consent` endpoint
2. ⬜ On withdrawal: flag patient for data deletion (start 30-day erasure window)
3. ⬜ Preserve audit trail: what was processed before withdrawal (legal)
4. ⬜ Retroactive: do not use data collected after withdrawal date

**Timeline:** Complete by Week 5  
**Owner:** Saugata + Sahil

---

## 3. DPDP Rules 2025 (MeitY Draft) Alignment

| Rule | Requirement | Status | Action |
|------|-------------|--------|--------|
| Rule 2 | Personal data classification | ⚠️ Partial | [PII_FIELD_MAP.md](PII_FIELD_MAP.md) done; need review |
| Rule 3 | Data localization mechanism | 🔴 Missing | Add config check: `assert db_region == "ap-south-1"` |
| Rule 4 | Security audits | 🔴 Missing | Week 6: OWASP audit + encryption spot-check |
| Rule 5 | Breach notification | 🔴 Missing | Draft incident response plan |
| Rule 6 | Transparency reports | 🔴 Missing | Quarterly audit log summary |

---

## 4. Encryption & Security Requirements

### Current Gaps
- [ ] All photos encrypted at rest (AES-256-GCM)
- [ ] All API endpoints HTTPS-only (TLS 1.2+)
- [ ] Database passwords rotated monthly
- [ ] Encryption keys managed via AWS KMS or vault
- [ ] Spot-check: sample 5 photos in database; confirm not plaintext

### Timeline
**Week 1:** Audit encryption status  
**Week 6:** Verify encryption + TLS enforcement

---

## 5. Compliance Checklist (Must-Have Before Production)

### Phase 1: Policy & Transparency (Week 1)
- [ ] Plain-language consent notice (2 languages)
- [ ] Data localisation policy (Mumbai only)
- [ ] Retention schedule (7 years clinical, indefinite research anonymised)
- [ ] Breach notification template

### Phase 2: Technical (Week 2)
- [ ] Anonymisation module (HMAC, k-anon ≥5, tested)
- [ ] Erasure pipeline (all 26 tables, verified)
- [ ] Data export with k-anonymity check
- [ ] Audit log: every read, write, delete, login

### Phase 3: Encryption & Audit (Week 6)
- [ ] Encryption audit: photos AES-256-GCM, database at rest
- [ ] TLS enforcement: all API endpoints HTTPS-only
- [ ] OWASP Top 10 checklist (gaps documented)
- [ ] Privacy Impact Assessment (for IEC ethics submission)

### Phase 4: Ongoing
- [ ] Quarterly audit log review
- [ ] Annual security assessment
- [ ] Incident response drills (quarterly)

---

## 6. Risks & Mitigation

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Data exfiltrated outside India | Reg violation | Data localisation config check | Shivraj |
| Patient cannot delete their data | Legal exposure | Erasure pipeline with 72-hr SLA | Saugata |
| Photos stored unencrypted | SPD violation | Encryption audit in Week 6 | Shivraj |
| Consent not documented | Consent withdrawn | Consent versioning + audit log | Saugata |
| k-anonymity not verified on export | Re-id risk | k-anon verification in export endpoint | Saugata |
| Breach not reported | Reg violation | Incident response plan + 72-hr notification | Saugata |

---

## 7. Sign-Off

This gap analysis must be reviewed and approved by Prof. Dipak Kumar Das (PI) before production deployment.

**Reviewed by:** _____________________ (Name)  
**Date:** ___________________  
**Approved:** ☐ Yes | ☐ Conditional | ☐ No

**Conditions (if applicable):**  
_______________________________________

---

## 8. References

- DPDP Act 2023: [Official Act text](https://www.meity.gov.in)
- DPDP Rules 2025 (draft): [MeitY notice]
- Carnegie Endowment analysis: [DPDP compliance framework]
- WHO Guidelines on Health Data Protection

---

## 9. Appendix: Timeline

```
Week 1: PII audit + DPDP analysis + transparency notice + localisation policy
Week 2: Anonymisation + erasure pipeline + data export + encryption audit (phase 1)
Week 3: Federated learning PoC
Week 4: Multimodal AI + NLP
Week 5: RAG + consent versioning + withdrawal mechanism
Week 6: Encryption audit (phase 2) + OWASP checklist + Privacy Impact Assessment
```

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-15  
**Next Review:** After PI sign-off

