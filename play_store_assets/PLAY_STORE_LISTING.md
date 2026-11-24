# Google Play Store Listing Metadata — DiabetesCare AI (v4.0.0)

> **Package ID:** `com.iitkgp.diabetescareai`
> **Version:** `4.0.0` (`versionCode: 4`)
> **Privacy Policy URL:** `https://doctor-dashboard-mu.vercel.app/privacy-policy.html`

---

## 1. Store Listing Text

### App Name (Max 30 characters in Play Console)
- **Recommended Play Console Title (28 chars):** `DiabetesCare AI: Foot Triage`
- **Alternate Short Title (15 chars):** `DiabetesCare AI`
- **Full Display Subtitle / Brand Title (for graphics/docs, 36 chars):** `DiabetesCare AI — Diabetic Foot Care` *(Note: Play Console's App Name field has a strict 30-character limit; use `DiabetesCare AI: Foot Triage` in the App Name field and place the full subtitle in the Short/Full Description.)*

### Short Description (79 / 80 characters)
```text
AI-assisted diabetic foot screening & 3-photo clinical triage for doctors & ASHA
```

### Full Description (2,420 / 4,000 characters)
```text
DiabetesCare AI is a clinical screening, standardized photography, and tele-triage application developed by the School of Nano Science & Technology (SNST), IIT Kharagpur in collaboration with Midnapore Medical College & Hospital (MMCH).

Built for community health programs and hospital diabetic foot clinics, DiabetesCare AI connects field health workers, clinical moderators, and doctors in a single unified workflow.

KEY CAPABILITIES

1. Unified 4-Role Clinical Portal
• Doctor: Create patient records, capture the 3-photo screening sequence, attach optional previous medical reports, add concise clinical notes (diagnosis, severity, treatment, medication), manage follow-up visits, and validate community-submitted cases.
• Field Worker (ASHA / ICDS / CHO): Collect patient vitals and capture standardized 3-photo wound/foot screenings during community outreach—without requiring clinical diagnosis entry—and track moderation and payout status.
• Clinical Moderator: Review field-submitted patient vitals and 3-photo quality checks, then approve or return cases with structured feedback.
• Hospital Administrator: Monitor screening volume, verify registered clinical staff, review submissions, and manage transparent incentive payouts.

2. Standardized 3-Photo Calibration Protocol
Guided step-by-step capture ensures consistent clinical photography:
• Photo 1 (Distance): Full-view anatomical orientation with a reference coin beside the affected area.
• Photo 2 (Closer): Regional wound framing for clinical context.
• Photo 3 (Even Closer): High-detail macro capture for AI quality verification and physician review.

3. Automated Image Quality Check & Longitudinal Follow-Up
Every submission passes through an automated quality verification check (blur, lighting, framing, and reference visibility) before entering physician triage or follow-up tracking via Patient ID.

4. Privacy & Security First (DPDP Act 2023)
• Role-based authentication supporting email, phone, username, or worker ID.
• Encrypted transmission (TLS/HTTPS) and full audit logging.
• Zero third-party ads and zero sale of health data.

CLINICAL DISCLAIMER
DiabetesCare AI is a clinical documentation, image-quality screening, and triage support tool intended for authorized healthcare workers and clinicians. It does not replace independent medical judgment, diagnosis, or treatment by a licensed physician.
```

### App Category & Tags
- **App or Game:** App
- **Category:** `Medical`
- **Tags:** `Healthcare`, `Medical`, `Clinical Triage`
- **Contact Email:** `privacy@diabetescare-ai.iitkgp.ac.in`
- **Website:** `https://doctor-dashboard-mu.vercel.app`

---

## 2. Graphic Assets Ready in `play_store_assets/`

| Asset Type | File Path | Dimensions | Format |
| :--- | :--- | :--- | :--- |
| App Icon | `play_store_assets/app_icon_512x512.png` | 512 × 512 px | PNG (RGBA, full-bleed) |
| Feature Graphic | `play_store_assets/feature_graphic_1024x500.png` | 1024 × 500 px | PNG (RGB) |
| Phone Screenshot 1 | `play_store_assets/screenshots/screen_login.png` | 1080 × 1920 px | PNG (9:16) |
| Phone Screenshot 2 | `play_store_assets/screenshots/screen_3photo_lock.png` | 1080 × 1920 px | PNG (9:16) |
| Phone Screenshot 3 | `play_store_assets/screenshots/screen_ai_review_real.png` | 1080 × 1920 px | PNG (9:16) |
| Phone Screenshot 4 | `play_store_assets/screenshots/screen_doctor_diagnosis.png` | 1080 × 1920 px | PNG (9:16) |
| Phone Screenshot 5 | `play_store_assets/screenshots/screen_doctor_hub.png` | 1080 × 1920 px | PNG (9:16) |

---

## 3. Data Safety Form Answers (Play Console)

- **Does your app collect or share any of the required user data types?** `Yes`
- **Is all of the user data collected by your app encrypted in transit?** `Yes` *(Ensure the mobile app points to your HTTPS production API URL, e.g. Render HTTPS URL, before uploading to Production!)*
- **Do you provide a way for users to request that their data is deleted?** `Yes`
  - **Delete account / data request URL:** `https://doctor-dashboard-mu.vercel.app/privacy-policy.html#deletion` (or `https://doctor-dashboard-mu.vercel.app/privacy-policy.html`)
- **Independent Security Review:** Optional (`No`)

### Data Types Collected (Not Shared with Third Parties)
1. **Personal info**
   - **Name:** Collected (Required) — App functionality, Account management
   - **Email address:** Collected (Optional/Account) — App functionality, Account management
   - **Phone number:** Collected (Optional/Account) — App functionality, Account management
   - **User IDs (Worker ID / Username / Patient ID):** Collected (Required) — App functionality, Account management
2. **Health and fitness**
   - **Health info** *(Age, weight, blood pressure, blood sugar, comorbidities, clinical notes, uploaded medical reports)*: Collected (Required for screening workflow) — App functionality
3. **Photos and videos**
   - **Photos** *(3-photo diabetic foot screening sequence & medical report images)*: Collected (User-initiated camera/gallery capture) — App functionality
4. **Data handling flags for all above types:**
   - **Collected:** Yes
   - **Shared:** No *(strictly stored on institutional backend; no third-party sharing or ad SDKs)*
   - **Processed ephemerally?** No *(persisted for longitudinal clinical follow-up)*
   - **Required or optional?** Account fields required for login; clinical vitals/photos required only when submitting a patient screening; previous reports optional.

---

## 4. App Access (Instructions for Google Play Reviewers)

Because DiabetesCare AI requires authentication across 4 roles, select **"All or some functionality is restricted"** in Play Console -> **App content -> App access**, and provide active reviewer credentials pointing to your live HTTPS backend:

### Seeded Reviewer Test Accounts (Built into Backend)
These accounts are automatically seeded by `backend/api/workflow_routes.py` and accept email, worker ID, username, or phone number as the login identifier:

| Role | Role Card in App | Email | Worker ID / Username / Phone | Password | Notes for Reviewer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Doctor** | Doctor | `doctor@demo.in` | `DOC_IITKGP_01` / `doctor` / `9831000001` | `doctor123` | Full screening + clinical note + follow-up + ASHA validation queue |
| **Field Worker (ASHA)** | ASHA / ICDS / CHO | `asha@demo.in` | `ASHA_WB_0042` / `asha001` / `9831000002` | `asha123` | Patient vitals + 3-photo capture + status tracking (also seeded: `icds@demo.in` / `icds123`, `cho@demo.in` / `cho123`) |
| **Moderator** | Moderator | `moderator@demo.in` | `MOD_MMCH_01` / `mod001` / `9831000004` | `mod123` | Review pending ASHA records & approve/reject |
| **Admin** | Admin | `admin@hospital.in` | `ADMIN_MMCH_01` / `admin` / `9831000005` | `admin123` | System stats, user management, submissions, payouts |

### Reviewer Step-by-Step Instructions (Paste into Play Console)
```text
1. Launch the app and select any of the 4 clinical roles (Doctor, ASHA/ICDS/CHO, Moderator, or Admin).
2. Sign in using the corresponding test credentials above (or tap "Register" to create a new test account dynamically).
3. As Doctor or ASHA: tap "New Patient Record", enter sample patient vitals (e.g., Age 55, Weight 68, BP 130/80, Blood Sugar 180), and proceed to the 3-photo guided capture screen (camera permission requested on demand).
4. As Moderator: inspect the pending field submission queue and approve or reject a test submission.
5. As Admin: view dashboard metrics, user list, submissions, and payment records.
Note: Test accounts operate against a staging clinical review environment with synthetic demo data.
```

---

## 5. Target Audience, Content Rating & Health Declaration

### Target Audience & Content
- **Target Age Group:** `18 and over` *(Healthcare professionals, field health workers, and clinical administrators only)*
- **Appeal to Children:** `No`
- **Ads:** `No, my app does not contain ads`

### Content Rating (IARC Questionnaire)
- **Category:** `Reference, News, or Educational` / `Utility, Productivity, Communication, or Other`
- **Violence / Sexuality / Profanity / Gambling / Controlled Substances:** `No` to all
- **User-Generated Content (Public Social Sharing):** `No` *(Clinical submissions are private to authorized healthcare staff only)*
- **Shares user physical location with other users?** `No`
- **Expected Rating:** `Everyone` / `3+` (PEGI 3 / USK 0)

### Google Play Health Apps Declaration
- Select applicable health app features:
  - **Clinical Decision Support** (triaging/reviewing wound screenings by licensed doctors)
  - **Disease Management / Healthcare Services & Telehealth** (longitudinal diabetic foot follow-up and community-to-hospital referral)
- **Medical Device / Regulatory Note:** Indicate that the app is an institutional clinical research & screening support platform developed by **IIT Kharagpur & MMCH** and includes clear in-app and policy disclaimers stating it assists—and does not replace—licensed physician diagnosis.
