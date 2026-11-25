# 🩺 DiabetesCare AI v4.0 — Clinical Workstation, Mobile App & Play Store Release

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Production-success?style=for-the-badge&logo=vercel)](https://doctor-dashboard-mu.vercel.app/)
[![GitHub Mobile App](https://img.shields.io/badge/GitHub-Mobile--app--Updated-181717?style=for-the-badge&logo=github)](https://github.com/saugata-malakar/Mobile-app-Updated)
[![GitHub Master Repo](https://img.shields.io/badge/GitHub-SNST--Saugata-181717?style=for-the-badge&logo=github)](https://github.com/saugata-malakar/SNST-Saugata)
[![Android APK v4.0](https://img.shields.io/badge/Download%20APK-v4.0.0%20Signed-blue?style=for-the-badge&logo=android)](https://github.com/saugata-malakar/Mobile-app-Updated/raw/main/DiabetesCareAI.apk)
[![Play Store AAB](https://img.shields.io/badge/Play%20Store%20AAB-v4.0.0%20Ready-34A853?style=for-the-badge&logo=googleplay)](https://github.com/saugata-malakar/Mobile-app-Updated/raw/main/play_store_assets/DiabetesCareAI-v4.0.0.aab)
[![User Manual](https://img.shields.io/badge/User%20Manual-23%20Pages%20PDF-red?style=for-the-badge&logo=adobeacrobatreader)](https://github.com/saugata-malakar/Mobile-app-Updated/blob/main/DiabetesCare_AI_Official_User_Manual.pdf)
[![DPDP Act 2023](https://img.shields.io/badge/DPDP%20Act%202023-Statutory%20Compliant-009688?style=for-the-badge&logo=shield)](https://doctor-dashboard-mu.vercel.app/privacy-policy.html)

**DiabetesCare AI (v4.0.0)** is an institutional diabetic foot ulcer (DFU) clinical data collection, AI quality-checked wound screening, moderation, and telehealth workstation developed with **IIT Kharagpur (SMST)** and **Midnapore Medical College & Hospital (MMCH)**.

Version **4.0.0** unifies the **Android Mobile App** (`com.iitkgp.diabetescareai`), **React Website & Admin Panel**, and **FastAPI + OpenCV/ML Backend** around a complete **4-Role Clinical Workflow** (`Doctor`, `ASHA / ICDS / CHO`, `Moderator`, `Admin`) with Google Play Store release readiness.

---

## 🌐 Live Links & Release Downloads

| Resource | Direct Link | Details |
|---|---|---|
| 📲 **Android Release APK (v4.0.0)** | **[Download DiabetesCareAI.apk (28.27 MB)](https://github.com/saugata-malakar/Mobile-app-Updated/raw/main/DiabetesCareAI.apk)** | Signed release APK (`com.iitkgp.diabetescareai`, `versionCode 4`). Supports direct registration/login for all 4 roles, camera capture, and system/gallery image upload. |
| 🛍️ **Google Play App Bundle (.aab)** | **[Download DiabetesCareAI-v4.0.0.aab (27.57 MB)](https://github.com/saugata-malakar/Mobile-app-Updated/raw/main/play_store_assets/DiabetesCareAI-v4.0.0.aab)** | Play-Store-ready signed `.aab` bundle (`jarsigner` verified). |
| 📋 **Play Store Deployment Kit** | **[PLAY_STORE_DEPLOYMENT_GUIDE.md](https://github.com/saugata-malakar/Mobile-app-Updated/blob/main/play_store_assets/PLAY_STORE_DEPLOYMENT_GUIDE.md)** · **[Listing Copy](https://github.com/saugata-malakar/Mobile-app-Updated/blob/main/play_store_assets/PLAY_STORE_LISTING.md)** | 512×512 icon, 1024×500 feature graphic, 1080×1920 screenshots, Data Safety & Health App declarations, and step-by-step Play Console checklist. |
| 🚀 **Live Website & Admin Panel** | **[doctor-dashboard-mu.vercel.app](https://doctor-dashboard-mu.vercel.app/)** | Unified web portal for Doctors, Field Collectors, Moderators, and Admins. |
| 🛡️ **Privacy Policy URL** | **[doctor-dashboard-mu.vercel.app/privacy-policy.html](https://doctor-dashboard-mu.vercel.app/privacy-policy.html)** | DPDP Act 2023 & Google Play compliant Privacy Policy (`doctor-dashboard/public/privacy-policy.html`). |
| 📑 **Official User Manual (PDF)** | **[DiabetesCare_AI_Official_User_Manual.pdf](https://github.com/saugata-malakar/Mobile-app-Updated/blob/main/DiabetesCare_AI_Official_User_Manual.pdf)** | 23-page clinical user manual and architecture reference. |
| 📦 **Mobile & Backend Monorepo** | **[github.com/saugata-malakar/Mobile-app-Updated](https://github.com/saugata-malakar/Mobile-app-Updated)** | Production React Native app, Vite website, FastAPI backend, and Play Store assets. |
| 🏛️ **Master Research Repository** | **[github.com/saugata-malakar/SNST-Saugata](https://github.com/saugata-malakar/SNST-Saugata)** | Complete research workspace repository. |
| 🖥️ **Local FastAPI Master (:8000)** | **[http://localhost:8000/](http://localhost:8000/)** · **[API Docs](http://localhost:8000/docs)** | Unified backend + SQLite persistence (`START_SERVER.bat`). LAN IP configurable inside the app. |

---

## 🔄 Exact 4-Role Clinical Workflows & Payouts

### 1. 👨‍⚕️ Doctor (`doctor`)
* **Direct Submission Flow**:
  1. Register or sign in (Email, Phone, Username, or Worker ID + Password).
  2. Enter Patient Details: **Name, Age, Weight (kg), Blood Pressure (Sys/Dia), Blood Sugar (mg/dL), Comorbidities** (or toggle **1-Month Follow-Up** using existing Patient ID).
  3. Capture or upload **3 System/Gallery Photos** (`1. From a distance` → `2. Closer` → `3. Even closer`, with a coin placed flat just beside the affected area).
  4. Upload **Previous Medical Reports** (optional images/PDFs).
  5. Write **Clinical Note** (mandatory 1–2 lines: diagnosis, severity, treatment needed, medication).
  6. Submit → **Automatic AI Quality Check** → Accepted (`Doctor ₹80 + Helper ₹20 = ₹100`) or Rejected (`₹0`).
* **Validate Field Collector Records Queue**: Review Moderator-approved ASHA/ICDS/CHO submissions, add clinical note → Credits `Doctor ₹30` + `Field Collector ₹50`.

### 2. 📋 ASHA / ICDS / CHO (`field_worker`)
* **Field Collection Flow**:
  1. Register (select `ASHA`, `ICDS`, or `CHO` + District) or sign in.
  2. Enter Patient Details (Name, Age, Weight, BP, Blood Sugar, Comorbidities / Follow-up ID).
  3. Capture or upload **3 System/Gallery Photos** (`Distance` → `Closer` → `Even closer`, coin beside area).
  4. Submit **without** writing diagnosis, severity, treatment, or medication.
  5. Pipeline: **AI Quality Check** → **Moderator Review** (`₹20`) → **Doctor Completion** (`₹30`) → **Accepted & Paid** (`Field Collector ₹50`, total `₹100`).

### 3. 🔍 Moderator (`moderator`)
* Reviews ASHA/ICDS/CHO records that passed AI quality checks in both the **Mobile App** and **Website (`/moderator`)**.
* Inspects patient vitals, AI quality scores, and zoomable 3-angle photos.
* **Approve** (`₹20` credited, forwards to Doctor Queue) or **Reject** (mandatory rejection reason).

### 4. ⚙️ Admin (`admin` — All-Access Governance & Verification Gate)
* Full control center in both **Website (`/admin-overview`, `/admin/users`, `/admin/submissions`, `/admin/payments`)** and **Mobile App (`AdminHomeScreen`)**:
  * **Account Verification Gate (All Roles)**: Every newly registered account (**Doctor, ASHA/ICDS/CHO, Moderator, Admin, Patient**) starts in **`pending`** status and cannot sign in until an Administrator verifies & approves (`✓ Verify & Approve`) or rejects (`✕ Reject`) the account in **Admin → Users**.
  * **All-Access Portal Switcher**: Admin can access every portal & route across the platform (**Doctor Portal, Validation Queue, ASHA/Field Collector, Moderator QA, Patient View, DPDP Compliance, Settings**) with full permissions.
  * **Submissions Inspector & Overrides**: Inspect every submission, all 3 photos (+ AI overlays), medical reports, moderator decisions, doctor clinical notes, and execute **Admin Overrides** (Force Accept / Force Reject).
  * **Payments Ledger & Payout Rates**: Track ₹80 / ₹20 / ₹50 / ₹20 / ₹30 splits, Mark Paid, Export CSV, and configure payout rates.

---

## 🔑 Multi-Option Login & Seeded Test Accounts

Newly registered accounts for **all roles** (`Doctor`, `ASHA / ICDS / CHO`, `Moderator`, `Admin`, `Patient`) enter **`pending` Admin verification** until approved. Pre-seeded demo accounts are pre-verified for immediate testing via **Email, Phone Number, Username, or Worker ID + Password** (or 1-click quick cards):

| Role | Email | Worker ID / Username | Phone | Password |
|---|---|---|---|---|
| **Doctor** | `doctor@demo.in` | `DOC_IITKGP_01` / `doctor` | `9831000001` | `doctor123` |
| **ASHA** | `asha@demo.in` | `ASHA_WB_0042` / `asha001` | `9831000002` | `asha123` |
| **ICDS** | `icds@demo.in` | `ICDS_WB_0010` / `icds001` | `9831000003` | `icds123` |
| **CHO** | `cho@demo.in` | `CHO_WB_0015` / `cho001` | `9831000006` | `cho123` |
| **Moderator** | `moderator@demo.in` | `MOD_MMCH_01` / `mod001` | `9831000004` | `mod123` |
| **Admin** | `admin@hospital.in` | `ADMIN_MMCH_01` / `admin` | `9831000005` | `admin123` |
| **Patient** | `patient@demo.in` | `PAT_KGP_01` / `patient` | `9831000007` | `patient123` |

---

## 🛠️ Running Locally & Building

```bash
# 1. Start Unified FastAPI Backend + Website SPA (:8000)
START_SERVER.bat

# 2. Run Backend v4 Workflow Tests
python -m pytest backend/tests/test_workflow_v4.py -v

# 3. Rebuild Website (doctor-dashboard)
cd doctor-dashboard && npm run build

# 4. Sideload Signed Android APK
adb install -r DiabetesCareAI.apk
```
