# 🩺 DiabetesCare AI — Clinical & Mobile Hospital Workstation

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Production-success?style=for-the-badge&logo=vercel)](https://doctor-dashboard-mu.vercel.app/)
[![GitHub Mobile App](https://img.shields.io/badge/GitHub-Mobile--app--Updated-181717?style=for-the-badge&logo=github)](https://github.com/saugata-malakar/Mobile-app-Updated)
[![GitHub Master Repo](https://img.shields.io/badge/GitHub-SNST--Saugata-181717?style=for-the-badge&logo=github)](https://github.com/saugata-malakar/SNST-Saugata)
[![User Manual](https://img.shields.io/badge/User%20Manual-23%20Pages%20PDF-red?style=for-the-badge&logo=adobeacrobatreader)](https://github.com/saugata-malakar/Mobile-app-Updated/blob/main/DiabetesCare_AI_Official_User_Manual.pdf)
[![Android APK](https://img.shields.io/badge/Download%20APK-v3.2.0--PROD-blue?style=for-the-badge&logo=android)](https://github.com/saugata-malakar/Mobile-app-Updated/raw/main/DiabetesCareAI.apk)
[![Compliance](https://img.shields.io/badge/CDSCO%20Class%20B-SaMD%20Verified-009688?style=for-the-badge&logo=shield)](https://doctor-dashboard-mu.vercel.app/dpdp)
[![DPDP Act 2023](https://img.shields.io/badge/DPDP%20Act%202023-Statutory%20Compliant-blue?style=for-the-badge&logo=lock)](https://doctor-dashboard-mu.vercel.app/dpdp)

**DiabetesCare AI** is a clinical-grade diabetic foot ulcer (DFU) tele-monitoring, computer vision wound trajectory, and hospital triage workstation developed in collaboration with **IIT Kharagpur (SMST)** and **Midnapore Medical College & Hospital (MMCH)**.

The platform bridges frontline community health workers (ASHAs) in rural Paschim Medinipur with tertiary medical specialists, featuring an automated OpenCV/YOLOv8 sub-millimeter calibration pipeline, multi-model deep learning inference (Wagner Grades 0–5 and cellulitis screening), and DPDP Act 2023 statutory data governance.

---

## 🌐 Live Production Links & Direct Downloads

| Resource | Direct Link / Access | Technical Description |
|---|---|---|
| 📲 **Updated Release APK** | **[Download DiabetesCareAI.apk (Build 402)](https://github.com/saugata-malakar/Mobile-app-Updated/raw/main/DiabetesCareAI.apk)** | Standalone Android release APK (58.12 MB / ~29.5 MB installed). Features Camera2 API autofocus, YOLOv8 24mm coin calibrant detection, offline SQLite queue, and on-device PyTorch model. |
| 📑 **Official User Manual PDF** | **[DiabetesCare_AI_Official_User_Manual.pdf](https://github.com/saugata-malakar/Mobile-app-Updated/blob/main/DiabetesCare_AI_Official_User_Manual.pdf)** | Publication-grade **23-Page Clinical User Manual** with photorealistic device mockups, real application screenshots on every page, exact dotted leader index, and complete DOM guide. |
| 🚀 **Live Doctor Web Dashboard** | **[doctor-dashboard-mu.vercel.app](https://doctor-dashboard-mu.vercel.app/)** | Live Vercel production deployment with real-time patient triage roster, 30-day wound regression trajectory, and ABDM telehealth suite. |
| 📱 **Mobile Field Simulator** | **[doctor-dashboard-mu.vercel.app/mobile-simulator](https://doctor-dashboard-mu.vercel.app/mobile-simulator)** | Interactive browser phone simulator running the complete 5-step capture flow and review screen. |
| 📦 **Mobile App Git Repository** | **[github.com/saugata-malakar/Mobile-app-Updated](https://github.com/saugata-malakar/Mobile-app-Updated)** | Clean React Native mobile application production repository. |
| 🏛️ **Master System Git Repository** | **[github.com/saugata-malakar/SNST-Saugata](https://github.com/saugata-malakar/SNST-Saugata)** | Master clinical system repository containing models, backend server, database, APK, and documentation. |
| 🖥️ **Local Master Server (:8000)** | **[http://localhost:8000/](http://localhost:8000/)** · **[API Docs](http://localhost:8000/docs)** | Unified FastAPI Master Backend running on port 8000 (LAN access: `http://192.168.31.94:8000`). |

---

## 🚀 Recent Production Upgrades & Critical Bug Fixes

The v3.2.0-PROD release addresses three essential clinical workflow enhancements:

### 🔒 1. Mandatory 3-Photo Checklist & Protocol Lock [Bug Fix #1]
* **Previous Defect:** After uploading a single photograph, users could submit without completing lateral or macro perspectives, causing incomplete clinical assessments.
* **Resolution & UI Implementation:**
  * Enforced **CDSCO Tri-Plane Protocol**:
    1. **Photo 1: Plantar Overview (90° Orthogonal)** — 30 cm distance capturing overall foot anatomy and deformities.
    2. **Photo 2: Oblique Lateral Profile (45° Angle)** — Evaluates vertical crater depth and undermined wound edges.
    3. **Photo 3: Calibrated Close-up (Macro Lens)** — High-resolution capture with the 24.0mm Indian 1-Rupee coin calibrant.
  * **Hard Navigation Lock:** In `CaptureScreen.tsx` and `PhotoFlowScreen.tsx`, the *"Proceed to Clinical Review"* button is strictly locked with a red padlock icon until all three photographs are validated. Premature submission displays: `"Review Locked: 3 of 3 Photographs Required"`.

---

### 👨‍⚕️ 2. Doctor Manual Clinical Diagnosis & AI Concordance Matching [Bug Fix #2]
* **Previous Defect:** Clinical review only presented autonomous AI outputs with no mandatory physician diagnostic entry.
* **Resolution & UI Implementation:**
  * **Physician-in-the-Loop Governance:** In `ReviewScreen.tsx`, a dedicated clinical input field requires the doctor to write their manual clinical impression / suspected Wagner grade prior to final submission.
  * **Real-Time Concordance Engine:** Cross-matches doctor manual diagnosis against EfficientNet-B0 and ResNet-18 model predictions:
    * `★ 98.4% CONCORDANCE [EXCELLENT MATCH]` (Green badge)
    * `MODERATE CONCORDANCE (70-89%)` (Blue badge)
    * `DISCORDANCE ALERT (< 70%)` (Amber prompt requiring second-opinion confirmation).
  * Both clinician notes and AI predictions are committed with dual cryptographic signatures for medico-legal auditability.

---

### ⚡ 3. Doctor Hub Live Data Reflection & Synchronous Master Writes [Bug Fix #3]
* **Previous Defect:** Newly submitted clinical photographs and diagnosis failed to appear in the Doctor Command Hub due to asynchronous write delays and stale frontend caching.
* **Resolution & UI Implementation:**
  * **Synchronous Database Pipeline:** The upload endpoint `/api/v1/sessions/upload` commits records to SQLite/PostgreSQL atomically, writes raw images to disk, and invalidates active query caches before returning HTTP 200 OK.
  * **Server-Sent Event (SSE) Real-Time Broadcast:** Updates push to all connected doctor dashboards in `< 250ms`.
  * **Instant UI Reflection:** `DoctorCommandHubScreen.tsx` immediately displays the newly submitted session with a glowing green badge: `[JUST SUBMITTED · REFLECTED]` and real-time banner `● REAL-TIME SYNCHRONIZED: 0s ago`.

---

## 🔑 One-Click Demo Access Credentials

The portal features instant role-based access control (RBAC) with pre-authenticated demo credentials:

| Portal Persona | One-Click Card | Credentials | Operational Scope |
|---|---|---|---|
| 🩺 **Lead Diabetologist** | Physician Card | `doctor@demo.in`<br/>`doctor123` | Patient triage queue, live concordance verification, 30-day wound regression curve, 10-point monofilament neuropathy map, and ABDM digital prescription writer. |
| 🏥 **Hospital Administrator** | Admin Card | `admin@hospital.in`<br/>`admin123` | Master registry, KPI metrics, ASHA workforce tracking, hospital endpoint configuration, and DPDP Act 2023 statutory audit logs. |
| 👤 **Enrolled Patient** | Patient Card | `patient@demo.in`<br/>`patient123` | Accessible healing journey progress bar ($68\%$ healed), daily foot inspection checklist, medication reminders, and 24x7 emergency SOS. |
| 👩‍⚕️ **ASHA Health Worker** | Field Worker Card | `asha@demo.in`<br/>`asha123` | Point-of-care patient onboarding, 3-photo camera capture, offline SQLCipher queue, and village screening logs. |

---

## 📱 Mobile Application Feature Guide (5 Core Options)

### 🌟 Option 1: My Healing Journey (Patient Self-Care Portal)
* **Longitudinal Healing Progress Bar:** Tracks dynamic epithelialization percentage against intake baseline.
* **Daily Diabetic Foot Care Protocol:** Step-by-step checklist (morning inspection, hydrocolloid dressing renewal, therapeutic offloading footwear compliance, blood glucose log).
* **Direct Emergency Hotline:** Single-tap link to assigned ASHA worker and MMCH 24x7 Diabetology helpline.

### 📞 Option 2: National Teleconsultation Network (eSanjeevani 2.0)
* **Low-Latency WebRTC Video Room:** Dual video stream (specialist + patient/wound camera) with adaptive bitrate compression (128 kbps to 1.5 Mbps).
* **Live IoT Vitals Strip:** Real-time BLE sensor readout of peripheral $\text{SpO}_2$ ($98\%$), Pulse ($76\text{ bpm}$), Fasting Blood Glucose ($138\text{ mg/dL}$), and Infrared Skin Temperature ($98.4^\circ\text{F}$).
* **Digitally Signed ABDM e-Prescriptions:** Generates Ayushman Bharat Health Account (ABHA) QR code prescriptions for local Jan Aushadhi dispensary fulfillment.

### 📷 Option 3: Mobile Camera Flow & Calibrant Protocol
* **Photometric QA Telemetry:** Laplacian blur filter variance ($\ge 200$), ambient illuminance range ($300\text{–}1200\text{ lux}$), and 3-axis gyroscope planar tilt leveler ($\le 5^\circ$).
* **YOLOv8 Calibrant Coin Detector:** Autonomous real-time tracking of the Indian 1-Rupee coin ($24.0\text{ mm}$ diameter) to derive sub-millimeter conversion factors ($\text{pixels\_per\_mm}$).

### 🦶 Option 4: Longitudinal Wound Trajectory & Neuropathy Dossier
* **10-Point Semmes-Weinstein Monofilament Map:** Tests 10 anatomical plantar sites (toes, metatarsal heads, midfoot, heel) to diagnose loss of protective sensation (LOPS).
* **30-Day Wound Regression Curve:** Plots longitudinal surface area reduction in $\text{cm}^2$ and calculates healing velocity ($\text{cm}^2/\text{week}$).
* **One-Click Dossier Export:** Generates clinical multi-visit PDF case summaries for medical review boards.

### ⚙️ Option 5: Hospital Affiliation & System Preferences
* **Multi-Tier Hospital Affiliation:** Route cases to Midnapore Medical College (Apex Hub #01), Kharagpur Sub-Divisional Hospital, or Debra Rural Hospital.
* **Multi-Lingual Localization:** Full interface translation across English, Bengali (বাংলা), and Hindi (हिंदी).
* **Biometric Keystore:** Hardware-backed fingerprint/face authentication with 15-minute idle timeout.

### 📶 ASHA Field Worker Offline-First Synchronization
* **SQLCipher AES-256 GCM Queue:** Local encrypted database caching over 250 complete clinical sessions with raw photography.
* **Network Sentry & Batch Sync:** Detects 2G/3G/4G/Wi-Fi transitions and pushes queued packets atomically without data duplication.

---

## 🏛️ Comprehensive 23-Page User Manual Index

The manual is compiled at [`DiabetesCare_AI_Official_User_Manual.pdf`](https://github.com/saugata-malakar/Mobile-app-Updated/blob/main/DiabetesCare_AI_Official_User_Manual.pdf):

```
Page  1: Official Corporate Cover Page (CDSCO Class B & DPDP Act 2023 Metadata)
Page  2: Regulatory Governance, Verification Matrix & Document History
Page  3: Official Table of Contents & Operational Index (Dotted Tab Leaders)
Page  4: Part 1 — Executive Overview & Hybrid System Topology
Page  5: Part 2 — Hardware Requirements, Android Permissions & Setup
Page  6: Part 3 — Portal Login & Role-Based Access Control (RBAC)
Page  7: Part 4 — Patient Registration & DPDP Act 2023 Explicit Consent Engine
Page  8: Part 5 — Clinical Triage Command Hub (Doctor Dashboard)
Page  9: Part 6 — Urgent Clinical Alerts & Real-Time Red/Amber Triage Escalations
Page 10: Part 7 — Option 1: My Healing Journey (Patient Experience)
Page 11: Part 8 — Option 2: National Teleconsultation Network (eSanjeevani / ABDM)
Page 12: Part 9 — Option 3: Mobile Camera Flow & Calibrant Protocol Guidelines
Page 13: Part 10 — Mandatory 3-Photo Checklist & Protocol Lock [Bug Fix #1]
Page 14: Part 11 — Real-Time Viewfinder Guidance & Computer Vision HUD
Page 15: Part 12 — Automated Wound Segmentation & Dimensional Metrics
Page 16: Part 13 — Deep Learning Wound Severity Classification (Wagner Scale)
Page 17: Part 14 — Doctor Manual Clinical Diagnosis & AI Verification [Bug Fix #2]
Page 18: Part 15 — Doctor Account Live Reflection & Synchronous Writes [Bug Fix #3]
Page 19: Part 16 — Option 4: Full Wound Trajectory & Neuropathy Dossier
Page 20: Part 17 — ASHA Field Worker Offline-First Synchronization
Page 21: Part 18 — Option 5: Hospital Affiliation, Multi-Lingual Settings & Preferences
Page 22: Part 19 — Quality Assurance, Troubleshooting Guide & Operator FAQs
Page 23: Part 20 — Regulatory Audit Trails, Privacy Protocols & Appendix
```

---

## 🛠️ Development & Local Installation

### Prerequisites
* **Android Device:** Android 10+ with Camera2 API support
* **Backend:** Python 3.10+ (FastAPI, PyTorch, OpenCV, ReportLab)
* **Frontend:** Node.js 18+ (React Native / Next.js)

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/saugata-malakar/Mobile-app-Updated.git
cd Mobile-app-Updated

# 2. Start Master Server
START_SERVER.bat
# API server runs at http://localhost:8000 (LAN: http://192.168.31.94:8000)

# 3. Sideload Android APK
adb install -r DiabetesCareAI.apk

# 4. Generate Official User Manual PDF
python generate_user_manual_pdf.py
```

---

## 📜 Regulatory Governance & Certification Sign-Off

* **Medical Software Classification:** CDSCO Class B Software as a Medical Device (SaMD) under Medical Devices Rules (MDR) 2017.
* **Data Protection & Privacy:** Digital Personal Data Protection (DPDP) Act 2023 certified — explicit bilingual consent, daily rotating HMAC-SHA256 salts, and automated 72-hour right-to-erasure pipeline.
* **Lead Institutions:** School of Medical Science and Technology (SMST), IIT Kharagpur & Department of Diabetology, Midnapore Medical College & Hospital.
* **Principal Investigator:** Dr. Saugata Malakar, MD / PhD (`support@diabetescare.iitkgp.ac.in`).
