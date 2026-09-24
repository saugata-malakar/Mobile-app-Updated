# 🩺 DiabetesCare AI — Clinical & Hospital Workstation

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Production-success?style=for-the-badge&logo=vercel)](https://doctor-dashboard-mu.vercel.app/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Mobile--app--Updated-181717?style=for-the-badge&logo=github)](https://github.com/saugata-malakar/Mobile-app-Updated)
[![FastAPI Backend](https://img.shields.io/badge/FastAPI-Port%208000-009688?style=for-the-badge&logo=fastapi)](http://localhost:8000/)
[![Compliance](https://img.shields.io/badge/DPDP%20Act%202023-Statutory%20Verified-blue?style=for-the-badge&logo=shield)](https://doctor-dashboard-mu.vercel.app/dpdp)
[![ABDM Telehealth](https://img.shields.io/badge/eSanjeevani%20%2F%20ABDM-Certified-green?style=for-the-badge)](https://doctor-dashboard-mu.vercel.app/teleconsults)

**DiabetesCare AI** is a clinical-grade diabetic foot ulcer (DFU) tele-monitoring, computer vision wound trajectory, and hospital triage workstation developed in collaboration with **IIT Kharagpur** and **Midnapore Medical College & Hospital (MMCH)**.

The platform provides role-based gateways for **Attending Clinicians**, **Hospital Administration**, and **Patients/Guardians**, powered by an automated OpenCV calibration pipeline and DPDP Act 2023 compliant data governance.

---

## 🌐 Live Production Links & Downloads

| Service | Live URL / Access | Description |
|---|---|---|
| 🚀 **Live Clinical Workstation** | **[doctor-dashboard-mu.vercel.app](https://doctor-dashboard-mu.vercel.app/)** | Production Vercel deployment with all 3 hospital portals. |
| 📱 **Mobile Field App Simulator** | **[doctor-dashboard-mu.vercel.app/mobile-simulator](https://doctor-dashboard-mu.vercel.app/mobile-simulator)** | Interactive Android phone simulator running the 5-step camera capture flow in-browser. |
| 📦 **GitHub Repository** | **[github.com/saugata-malakar/Mobile-app-Updated](https://github.com/saugata-malakar/Mobile-app-Updated)** | Clean production source code repository. |
| 📲 **Android Release APK** | **[Direct APK Download (28.2 MB)](http://10.109.27.73:9090/DiabetesCareAI.apk)** | Standalone Android APK built with WebKit JavaScriptCore (JSC) engine. |
| 🖥️ **Localhost Hub** | **[http://localhost:8000/](http://localhost:8000/)** | Local unified FastAPI + React Workstation. |

---

## 🔑 Demo Access Credentials

The login portal features instant one-click role cards that auto-populate authenticated demo credentials:

| Portal Role | One-Click Card | Credentials | Primary Features |
|---|---|---|---|
| 🩺 **Attending Physician** | Click **Physician Card** | `doctor@demo.in`<br/>`doctor123` | Clinical triage queue, 30-day wound area trajectory, AI overlay visualizer, 10-point neuropathy sensation map, and E-Prescription writer. |
| 🏥 **Hospital Authority** | Click **Hospital Admin Card** | `admin@hospital.in`<br/>`admin123` | Department operational triage, live KPI counters, ASHA field workforce roster, and DPDP Act 2023 statutory audit suite. |
| 👤 **Patient / Guardian** | Click **Patient Card** | `patient@demo.in`<br/>`patient123` | Accessible healing journey gauge ($68\%$ healed), dressing change reminder, active medication cards, and 24x7 emergency SOS. |

---

## 🏛️ Comprehensive Portal Walkthrough

### 🩺 1. Attending Clinician / Doctor Dashboard (`/`)
Designed for podiatric surgeons, diabetologists, and vascular specialists.

* **Interactive Triage Filter Dropdowns**:
  * **Urgency Filter**: Filter by *High Risk (Red Flag)*, *Moderate (Amber)*, or *Stable (Green)*.
  * **Wagner Grade Filter**: Filter by *Grade 0 (Intact)* to *Grade 4+ (Gangrene / Deep Tissue)*.
  * **District Filter**: Segment patients across *Paschim Medinipur*, *Jhargram*, *Purba Medinipur*, and *Bankura*.
* **Longitudinal Patient Deep-Dive (`/patients/PAT_KGP_01`)**:
  * **OpenCV AI vs. Original Toggle**: Switch between raw clinical photography and segmented wound contours with 20mm scale calibrant marker.
  * **Granular Tissue Classification Meter**: Real-time breakdown of **Granulation (68% - Red)**, **Slough (24% - Yellow)**, and **Necrotic Tissue (8% - Black)**.
  * **Multi-Metric Trajectory Graph**: Longitudinal Recharts tracking **Area ($cm^2$)**, **Length ($mm$)**, and **Width ($mm$)** across clinical visits.
  * **10-Point Semmes-Weinstein Monofilament Neuropathy Foot Map**: Interactive anatomical plantar sensory mapping indicating loss of protective sensation (LOPS).
* **Authoritative E-Prescription Writer (`/prescriptions/:patientId`)**:
  * Prescribe antibiotics (Augmentin, Ciprofloxacin), glycemic modulators (Metformin, Empagliflozin), and advanced topical dressings (Hydrocolloid, Silver Sulfadiazine).
  * Digital cryptographic signing with **NMC/State Medical Council Registration (`#78421-A`)**.

---

### 🏥 2. Hospital Authority & Administration Portal (`/admin-overview`, `/department`)
Designed for medical superintendents, department heads, and healthcare administrators.

* **Department Operational Triage**:
  * **Zero-Free Live KPI Counters**: Total registered patients ($168$), active ulcer cases ($52$), healed this month ($28$), open clinical red flags ($2$), and active ASHA field workers ($22$).
  * **Multi-Department Switcher Dropdown**: Seamlessly switch between *Diabetology & Podiatric Surgery*, *Vascular Surgery*, *Dermatology & Wound Care*, and *Community Medicine*.
  * **Wagner Ulcer Severity Breakdown**: Interactive Recharts bar chart showing cohort distribution across Wagner Grades 0 to 4.
  * **Inpatient Bed & Regional Tele-Node Queue**: Real-time bed occupancy and telemedicine node allocation across Kharagpur, Jhargram, and Tamluk sub-divisions.
* **ASHA Field Workforce Hub (`/asha`)**:
  * Real-time monitoring of community health workers with district filters.
  * Tracks patient screening throughput, field photography uploads, and sticker placement circularity pass rates ($97.8\%$).

---

### 🛡️ 3. DPDP Act 2023 Statutory Governance Suite (`/dpdp`)
Implements India's Digital Personal Data Protection Act (DPDP Act 2023) standards.

* **Statutory Compliance Scorecards**:
  * **Section 4 (Lawful Purpose)**: $100\%$ verified for clinical telemedicine and diagnostic triage.
  * **Section 6 (Granular Consent)**: Verifiable digital consent timestamps stored prior to photo capture.
  * **Section 8 (Data Security & Retention)**: AES-256 data encryption with automatic 90-day retention lifecycles.
  * **Section 11 (Grievance Redressal)**: Designated Data Protection Officer (DPO) contact channel.
* **Interactive SHA-256 Hash Integrity Verifier**:
  * Allows doctors and compliance officers to input patient MRNs and image tokens to mathematically verify records against the append-only cryptographic ledger.
* **Immutable Audit Log Ledger**:
  * Searchable table capturing every access event, clinician ID, IP address, timestamp, and verification status.
* **Statutory Report Export**: One-click generation of PDF compliance audit reports for health authority inspections.

---

### 🏛️ 4. Government-Verified National Teleconsultation Network (`/teleconsults`)
Integrated with **ABDM (Ayushman Bharat Digital Mission)** and **eSanjeevani** guidelines.

* **24x7 National Emergency Hotline Quick-Dial Bar**:
  * 🚨 **112** — National Emergency All-in-One
  * 🚑 **108** — Emergency Ambulance Dispatch
  * 🩺 **104** — 24x7 State Health Advice
  * 🩹 **1800-345-DIAB** — Dedicated Diabetic Foot Ulcer SOS Line
* **Live WebRTC Consultation Room**:
  * Encrypted video stream simulator connecting the attending doctor directly with rural ASHA workers and patients.
  * **Real-Time Patient Vitals Telemetry**: Continuous readout of Heart Rate ($78	ext{ bpm}$), $	ext{SpO}_2$ ($98\%$), and Random Blood Glucose ($184	ext{ mg/dL}$).
  * Integrated Doctor's Scratchpad and instant E-Rx dispatch.

---

### 👤 5. Patient & Guardian Portal (`/patient-portal`)
Clean, accessible, reassuring patient experience.

* **Healing Journey Circular Gauge**: Shows current healing progress (**$68\%$ Healed**).
* **Dressing Schedule & Care Plan**: Countdown timer for the next dressing change with direct phone link to the assigned village ASHA worker.
* **Active Prescriptions & Dosages**: Plain-language dosage schedule (Morning / Afternoon / Night) with food instructions.
* **One-Tap 🚨 Emergency SOS**: Instantly triggers emergency escalation to the nearest district hospital.

---

### 📱 6. Mobile Field App & Interactive Web Simulator (`/mobile-simulator`)
A complete community health worker mobile interface running inside the browser.

1. **Step 1 — Patient Demographics & DPDP Consent**: Enter patient name (*Ramesh Chandra Sen*), age (*58*), gender, and HbA1c (*9.4%*) with digital consent checkbox.
2. **Step 2 — 3-Photo Checklist**:
   * Photo 1: Anatomical Overview
   * Photo 2: Close-Up Ulcer Bed
   * Photo 3: Measurement Photo (with 20mm blue calibrant sticker)
3. **Step 3 — Camera Viewfinder with Real-Time Guidance**:
   * Simulated viewfinder with target crosshairs and 20mm sticker guide circle.
   * Real-time sensor feedback: **Distance: 25cm (OK)**, **Lighting: 380 Lux (Good)**, **Focus: Sharp**.
   * Interactive shutter button with flash capture animation.
4. **Step 4 — OpenCV AI Quality & Segmentation Review**:
   * Scale detection confirmation: **`20.0mm circular sticker detected`**.
   * Interactive **"Show/Hide Overlay"** toggle.
   * Measurements: **Length: 24.1mm, Width: 13.8mm, Surface Area: 2.57 $cm^2$**.
   * Tissue composition: **68% Granulation, 24% Slough, 8% Necrotic**.
5. **Step 5 — Cloud Sync Complete**: Synchronizes record to `http://10.109.27.73:8000` with DPDP SHA-256 integrity token.

---

## 🔬 Computer Vision Calibration Pipeline (`cv/`)

```
   Raw Mobile Photo
         │
         ▼
 ┌─────────────────┐
 │ Quality Gating  │ ──► Blur (Laplacian > 100), Glare (< 3%), Lighting (40 < μ < 220)
 └────────┬────────┘
          │ PASS
          ▼
 ┌─────────────────┐
 │ Calibrant Detect│ ──► HSV/LAB Blue Circle Isolation + Hough Transform
 └────────┬────────┘     Scale Metric: mm_per_px = 20.0 / diameter_pixels
          │
          ▼
 ┌─────────────────┐
 │ Wound Segment   │ ──► Multi-Threshold Morphological Contour Extraction
 └────────┬────────┘     Area (cm²) = Area_px * (mm_per_px / 10)²
          │
          ▼
 ┌─────────────────┐
 │ Tissue Classify │ ──► Color Space Clustering:
 └─────────────────┘     • Granulation (Red/Pink): Healthy Healing
                         • Slough (Yellow/Tan): Fibrinous Exudate
                         • Necrotic (Black/Brown): Non-viable Tissue
```

---

## 🛠️ Tech Stack & Architecture

* **Frontend**: React 19, Vite 8, Tailwind CSS v4, Recharts, Lucide Icons, React Router v7.
* **Mobile App**: React Native 0.73, Android Native, WebKit JavaScriptCore (JSC) International Engine.
* **Backend API**: Python 3.11, FastAPI, Uvicorn, Pydantic v2, PostgreSQL / SQLite.
* **Computer Vision**: OpenCV (cv2), NumPy, SciPy, Pillow.
* **Cloud & DevOps**: Vercel (Edge SPA), Render (Unified Full-Stack), Docker (Multi-stage Node+Python).

---

## 💻 Local Setup & Development

### 1. Clone Repository
```bash
git clone https://github.com/saugata-malakar/Mobile-app-Updated.git
cd Mobile-app-Updated
```

### 2. Run the FastAPI Backend
```bash
# Create Python virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scriptsctivate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

### 3. Run the Doctor Dashboard (React + Vite)
```bash
cd doctor-dashboard
npm install
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** (or **[http://localhost:8000/](http://localhost:8000/)** when mounted via FastAPI).

---

## 🚀 Cloud Deployment Guide

### Deploy on Vercel (1 Command)
```bash
cd doctor-dashboard
npm run build
npx vercel --prod --yes
```

### Deploy on Render (Full-Stack Python + React)
The repository includes `render.yaml` pre-configured to build the frontend and serve the FastAPI backend in Singapore (low-latency node for India):
1. Connect `https://github.com/saugata-malakar/Mobile-app-Updated` on [dashboard.render.com](https://dashboard.render.com/).
2. Select **Blueprint** (or Web Service) and click **Apply**.

### Deploy with Docker
```bash
docker build -t diabetescare-ai .
docker run -p 8000:8000 diabetescare-ai
```

---

## 📄 License & Attribution
* **Institution**: Indian Institute of Technology Kharagpur (IIT KGP) & Midnapore Medical College and Hospital (MMCH).
* **Principal Investigator**: Prof. Dipak Kumar Das.
* **DPDP Act Compliance**: Standardized under statutory guidelines of the Ministry of Electronics and Information Technology (MeitY), Government of India.
