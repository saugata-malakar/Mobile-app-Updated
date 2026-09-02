# Privacy Impact Assessment (PIA)
**For Institutional Ethics Committee (IEC) Submission**

---

## 1. Project Metadata

*   **Project Title**: DiabetesCare AI - Rural Clinical validation and Diabetic Foot Complication Screening
*   **Version**: 1.0 (Ethics Clearance)
*   **Data Controller**: DiabetesCare AI Technical and Clinical Board
*   **Lead Investigator**: Saugata Malakar (Privacy and Security Lead)
*   **Compliance Target**: Digital Personal Data Protection (DPDP) Act, 2023 (India)

---

## 2. Executive Summary

This Privacy Impact Assessment (PIA) evaluates the patient privacy controls, security safeguards, and compliance metrics implemented in the DiabetesCare AI platform. The platform collects sensitive clinical metrics and photographs of diabetic wounds to screen for severity and complications. 

Because the project collects human clinical validation data (wound photographs, blood glucose, medical history), this assessment is submitted to the Institutional Ethics Committee (IEC) to guarantee that all patient information is protected against disclosure, re-identification, and unauthorized access in compliance with Indian privacy laws.

---

## 3. Data Inventory & Sensitivity Classification

Under the DPDP Act 2023, the platform processes personal data and sensitive personal data (health metrics/images).

| Data Field | Sensitivity Classification | Processing Action | Retention Period |
| :--- | :--- | :--- | :--- |
| **Full Name** | Direct Identifier | Removed on export; hashed at rest | Duration of patient care |
| **Phone Number** | Direct Identifier | Hashed at rest; removed on export | Duration of patient care |
| **ABHA ID** | Direct Identifier | Removed on export; hashed at rest | Duration of patient care |
| **Age / Gender** | Quasi-Identifier | Generalized on export (age deciles) | 7 Years |
| **Village / District** | Quasi-Identifier | Generalized on export (district level) | 7 Years |
| **Wound Photographs** | Quasi-Identifier / Sensitive | **AES-256-GCM Encrypted at Rest** | 7 Years |
| **Clinical Metrics (HbA1c, BP)** | Sensitive Personal Data | Retained for model inference | 7 Years |
| **Audit Logs** | Technical Audit | Retained in secure database | 7 Years (Medical audit) |

---

## 4. Technical Privacy Safeguards

The platform employs a multi-tiered privacy-by-design architecture:

```
                  ┌──────────────────────────────────────────┐
                  │          Informed Consent Form           │
                  │   (ASHA Assisted / Signed & Versioned)   │
                  └────────────────────┬─────────────────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │         FastAPI HTTPS API Entry          │
                  │  (Role-Based Tokens / HTTPS-Only Proxy)  │
                  └────────────────────┬─────────────────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │        AES-256-GCM Encryption            │
                  │    (Photographs encrypted at rest)       │
                  └────────────────────┬─────────────────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │        DPDP Anonymisation Engine         │
                  │     (k-Anonymity k >= 5 validation)      │
                  └──────────────────────────────────────────┘
```

### 1. Encryption-at-Rest (AES-256-GCM)
All patient wound photographs are encrypted at rest using Advanced Encryption Standard in Galois/Counter Mode (AES-256-GCM). 
*   **Mechanism**: A unique 12-byte initialization vector (nonce) is generated for every image write. The base64 compressed image is encrypted, generating the ciphertext and a 16-byte authentication tag.
*   **Key Management**: The encryption key is derived via SHA-256 from the environment-managed secret key, ensuring that even if storage media is compromised, no patient images can be reconstructed.

### 2. Generalization & k-Anonymity (k ≥ 5)
Before clinical data is exported for research validation:
*   Direct identifiers (Name, ABHA ID, Phone) are completely stripped.
*   Quasi-identifiers (Age, Date, Location) are generalized into buckets (e.g., 30-39 age group, district-level location).
*   The **Anonymisation Engine** performs a group check. If any demographic grouping has a count of less than 5 individuals ($k < 5$), the export is rejected to prevent re-identification.

### 3. Patient Right to Erasure (DPDP Act Section 8)
Patients maintain absolute control over their data. Upon request (withdrawal of consent):
*   The `ErasurePipeline` is triggered.
*   It performs a cascading deletion in dependency order across all 26 relational database tables.
*   All corresponding photographs, clinical trials, prescriptions, and transaction records are fully purged from physical disks.
*   The patient's audit trails are securely deleted to remove all references to their identity.

---

## 5. Risk Assessment & Risk Mitigation Matrix

| Privacy Risk | Severity | Mitigation Controls | Residual Risk |
| :--- | :--- | :--- | :--- |
| **Data Leakage of Wound Photos** | High | AES-256-GCM encryption at rest. If the disk is stolen, the photos are undecipherable. | **Low** |
| **Re-identification in Exports** | Medium | Generalization of demographics and strict k-Anonymity (k >= 5) verification. | **Low** |
| **ASHA Worker Device Loss** | High | Devices registered by unique ID. Session tokens expire in 24 hours. Local base64 data is compressed and cleared immediately after sync. | **Medium** |
| **Man-in-the-Middle Attacks** | High | Enforced HTTPS-only middleware for all endpoints. | **Low** |

---

## 6. Conclusion and Certification

The technical and organizational measures implemented in the DiabetesCare AI platform satisfy the requirements of the Digital Personal Data Protection Act (DPDP), 2023, and are aligned with international guidelines for clinical research database administration. 

**Privacy Officer Certification**:
*This Privacy Impact Assessment certifies that patient data protection has been integrated into the system architecture, and clinical trials may proceed with minimal risk to patient privacy.*
