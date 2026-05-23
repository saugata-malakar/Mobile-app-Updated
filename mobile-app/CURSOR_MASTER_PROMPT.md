# DiabetesCare AI — Comprehensive Cursor Build Prompt
# Version 2.0 | May 2026
# Save this file as CURSOR_CONTEXT.md in the project root.
# At the start of every Cursor session, say:
# "Read CURSOR_CONTEXT.md before doing anything else."

---

## 0. HOW TO USE THIS DOCUMENT

This document is the single source of truth for building the DiabetesCare AI
mobile application. It is organized into:

- Section 1: Project context and clinical purpose
- Section 2: Existing codebase — what is already built
- Section 3: Architecture decisions — already made, do not change
- Section 4: Complete database schema — all 26 tables
- Section 5: Complete API specification
- Section 6: Complete screen specifications
- Section 7: Build phases — do Phase A before Phase B, B before C, etc.
- Section 8: Technical constraints and coding rules
- Section 9: Security requirements (non-negotiable)
- Section 10: Style and UX guidelines

Work through phases in order. Complete all tasks in Phase A before starting
Phase B. Never skip ahead.

---

## 1. PROJECT CONTEXT

### 1.1 What This App Does

DiabetesCare AI prevents diabetic amputations by monitoring wounds and their
contributing factors through smartphone photography and AI analysis.

The platform has TWO tracks running simultaneously in ONE app:

**Track 1 — Research Platform (grant-funded)**
ASHA community health workers screen diabetic patients in rural West Bengal
for foot wounds, skin infections, and contributing factors. Data feeds a
clinical validation study for publications and grants.

**Track 2 — Commercial Platform (subscription revenue)**
Diabetic patients subscribe (Rs. 299-799/month) to monitor their foot wounds
weekly at home. AI detects deterioration and alerts their doctor.

### 1.2 Three Clinical Modules — All Wound-Centric

Every module is justified within diabetic wound care. This is NOT a general
health screening app.

**Module 1: DFU Wound Monitor (core)**
Weekly photographs of diabetic foot ulcers. AI calculates wound area (cm²)
using a 1-rupee coin (25mm) as size reference, classifies Wagner Grade (0-5),
detects tissue type (granulation/slough/eschar), estimates infection
probability, tracks week-over-week healing trajectory, predicts closure date.

**Module 2: Periwound Skin Monitor (contributing factor 1)**
Monthly photographs of skin around the wound — foot, web spaces, lower leg.
AI classifies fungal infections (tinea pedis, tinea unguium, candida),
bacterial spreading infection, maceration, psoriatic/inflammatory skin
adjacent to wound. All findings reported as wound contamination risk.

**Module 3: Pallor and Eye Triage (contributing factors 2 and 3)**
Quarterly. Conjunctival pallor as haemoglobin proxy — severe anaemia impairs
wound healing by reducing tissue oxygenation. External red eye triage —
identifies urgent conditions (glaucoma, corneal ulcer) that prevent wound
self-care. NOT retinopathy screening. External eye only.

### 1.3 User Roles

- **Patient**: Diabetic patient. Uses mobile app.
- **ASHA Worker**: Community health worker. Uses mobile app (separate screens).
- **Doctor**: Reviews wound data, issues prescriptions. Web dashboard only — NOT in mobile app.
- **Admin**: System management. Web admin panel — NOT in mobile app.

### 1.4 Two Languages

All patient-facing and ASHA-facing content must be available in both:
- English (default for development)
- Bengali (বাংলা) — full Unicode, UTF-8

Language preference is stored in user profile and persists across sessions.
Switching language must reload all text without restarting the app.

### 1.5 Development Environment

- macOS, MacBook Pro, username: dipak
- Project root: /Users/dipak/HealthScreeningApp/
- Mobile app: /Users/dipak/HealthScreeningApp/HealthScreenApp/
- Backend: /Users/dipak/HealthScreeningApp/backend/
- Python: always use `python3` (never `python`)
- Bengali files: always use Python `open(path, 'w', encoding='utf-8')`
  with Unicode escape sequences — never write Bengali directly in bash heredocs
- Android AVD: Pixel 4, Android 17, API 37
- Metro port: 8081
- Flask port: 5001

---

## 2. EXISTING CODEBASE — DO NOT REBUILD, BUILD ON TOP

### 2.1 Mobile App — What Exists

Location: /Users/dipak/HealthScreeningApp/HealthScreenApp/

**Navigation:**
- Custom RootNavigator (prop-based, no react-navigation library dependency)
- Role-based routing: patient vs ASHA worker

**Screens already built (do not recreate):**
- SplashScreen
- RoleSelect
- PatientLogin — includes full registration form (name, phone, age, gender, village)
- AshaLogin
- AshaHome
- ConditionSelector — Bengali text, selects which module to run
- CameraScreen — photograph capture
- ResultScreen — displays AI risk level
- ConsultRequest — 3 modes (urgent/routine/follow-up)
- QueueStatus — shows teleconsult queue position
- PatientProfile — 3 tabs: History, Rx, Progress
- ConsentScreen — digital consent before screening
- AshaPatientRegister — ASHA registers a new patient

**Services layer (src/services/):**
- api.js — axios base config, BASE_URL = 'http://10.0.2.2:5001'
- authService.js — login, register, token storage
- screeningService.js — submit screening, get results
- consultationService.js — request consult, get queue
- patientService.js — get patient profile, history

**Bengali constants:**
- src/constants/bengali.js — all Bengali text strings as Unicode escapes

**Important constraints from existing code:**
- Prop-based navigation only — no navigator.navigate() style
- Bengali text always imported from bengali.js — never hardcoded inline
- All backend calls go through services layer — no direct fetch in screens
- Device emulator: use IP 10.0.2.2 to reach localhost Flask

### 2.2 Backend — What Exists

Location: /Users/dipak/HealthScreeningApp/backend/

**Stack:** Python Flask 3.0, SQLite (dev), SQLAlchemy, JWT

**Current tables (10):**
patients, asha_workers, doctors, screenings, consultations,
prescriptions, commissions, admins, devices, audit_logs

**Test suite:** 33 tests passing
Run with: `PYTHONPATH=/Users/dipak/HealthScreeningApp/backend pytest tests/ -v`

**Seed data:**
- 3 doctors
- 2 ASHA workers: asha001/1234, asha002/1234
- 1 test patient

**Run backend:**
```
cd /Users/dipak/HealthScreeningApp/backend
source venv/bin/activate
python3 app.py
```

**Existing endpoints (do not remove):**
- POST /api/auth/login
- POST /api/auth/register
- GET  /api/patients/<id>
- POST /api/screenings
- GET  /api/screenings/<patient_id>
- POST /api/consultations
- GET  /api/consultations/queue
- POST /api/asha/login
- GET  /api/asha/patients

---

## 3. ARCHITECTURE DECISIONS — ALREADY MADE, DO NOT CHANGE

**Decision 1: Wound sites are first-class entities**
A patient can have multiple simultaneous wounds (e.g., left heel AND right
toe). Each wound site has its own monitoring sessions, history, alerts, and
healing trajectory. NEVER merge wounds from different sites into one record.
Table: wound_sites. Every wound monitoring session MUST have a wound_site_id.

**Decision 2: AI processing is hybrid**
- Quality validation: on-device, real-time during photograph capture
  (TensorFlow Lite, fast small model)
- Clinical AI analysis: server-side, after photo submission
  (EfficientNet models, 3-8 seconds, acceptable latency)
- Fallback: Gemini 1.5 Pro Vision API when server confidence < 0.65

**Decision 3: Teleconsult = scheduled phone call**
The doctor calls the patient's registered phone number at a booked time.
The app manages: booking, notification, prescription delivery post-call.
No in-app video/audio. This is a deliberate decision for rural connectivity.

**Decision 4: One subscription covers all wound sites on a patient**
A patient with 2 active wounds pays Rs. 499/month total — not per site.

**Decision 5: Authentication**
- Registration: phone number + SMS OTP verification
- Login: phone + password (set during registration)
- Biometric: fingerprint via react-native-biometrics as primary login
  (fallback to password if biometric fails or not enrolled)
- Token: JWT, 24-hour expiry, silent refresh before expiry

**Decision 6: Conflict resolution for offline uploads**
If patient submits photos directly AND ASHA submits for same patient, same
wound site, same calendar day:
- Patient-submitted photographs take priority
- ASHA submission stored as secondary/supplementary
- Both shown to doctor, labelled by source
- Neither deleted

**Decision 7: ASHA geographic binding**
ASHA workers can only see patients whose village is in their covered villages
list. Enforced at database query level (WHERE clause), not just UI level.

**Decision 8: Consent versioning**
Stage 1 consent (wound + pallor) and Stage 2 consent (skin + red eye + full
study) are separate versions. Patients must re-consent when Stage 2 is
approved. The consent table tracks version and modules consented. Module
access is locked until appropriate consent version is on file.

**Decision 9: Session scheduling**
The system generates a session_schedule record for each expected submission
(weekly wound, monthly skin, quarterly contributing factor). The patient home
screen reads session_schedule to show what is due today and what is overdue.
Reminders are triggered from session_schedule, not hardcoded timers.

**Decision 10: Doctor access is web-only**
No doctor screens in the mobile app. If any existing code references a
DoctorDashboard screen in the mobile app, remove it. Doctors use the
React web dashboard at a separate URL.

---

## 4. COMPLETE DATABASE SCHEMA

Migrate the existing 10-table SQLite schema to this 26-table schema.
Keep all existing data. Add new tables. Modify existing tables where
column additions are needed (use ALTER TABLE or migration scripts).

When migrating to PostgreSQL for production, use the same schema.
All column names use snake_case. All IDs are UUIDs (string, not integer)
except where noted.

### 4.1 Core Authentication and Users

```sql
-- users: unified authentication for all roles
CREATE TABLE users (
    id TEXT PRIMARY KEY,  -- UUID
    phone_number TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient','asha','doctor','admin')),
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,  -- ISO 8601
    last_login_at TEXT,
    device_id TEXT,
    fcm_token TEXT,  -- Firebase push notification token
    preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en','bn'))
);
```

### 4.2 Patient Core Tables

```sql
-- patients: demographics and identifiers
CREATE TABLE patients (
    id TEXT PRIMARY KEY,  -- UUID
    user_id TEXT REFERENCES users(id),
    full_name TEXT NOT NULL,
    date_of_birth TEXT,  -- ISO 8601 date
    gender TEXT CHECK (gender IN ('male','female','other','prefer_not_to_say')),
    phone_number TEXT NOT NULL,
    village TEXT NOT NULL,
    block TEXT,
    district TEXT,
    state TEXT DEFAULT 'West Bengal',
    pin_code TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    abha_id TEXT,  -- Ayushman Bharat Health Account ID, optional
    is_research_participant INTEGER DEFAULT 0,
    is_commercial_subscriber INTEGER DEFAULT 0,
    created_by_asha_id TEXT REFERENCES asha_workers(id),  -- null if self-registered
    research_enrolled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- patient_medical_history: versioned medical information
-- A new row is added each time medical info is updated.
-- Use MAX(version_number) for current record.
CREATE TABLE patient_medical_history (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    version_number INTEGER NOT NULL DEFAULT 1,
    recorded_at TEXT NOT NULL,
    recorded_by_user_id TEXT REFERENCES users(id),
    diabetes_type TEXT CHECK (diabetes_type IN ('TYPE1','TYPE2','GESTATIONAL','UNKNOWN')),
    diabetes_duration_years REAL,
    hba1c_value REAL,  -- percentage
    hba1c_date TEXT,
    has_hypertension INTEGER DEFAULT 0,
    has_ckd INTEGER DEFAULT 0,  -- chronic kidney disease
    has_cad INTEGER DEFAULT 0,  -- coronary artery disease
    retinopathy_known INTEGER DEFAULT 0,
    neuropathy_known INTEGER DEFAULT 0,
    previous_dfu INTEGER DEFAULT 0,
    previous_dfu_count INTEGER DEFAULT 0,
    previous_amputation INTEGER DEFAULT 0,
    amputation_site TEXT,
    current_medications TEXT,  -- JSON array: [{name, dose, frequency}]
    smoking_status TEXT CHECK (smoking_status IN ('NEVER','FORMER','CURRENT','UNKNOWN')),
    bmi REAL,
    weight_kg REAL,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    notes TEXT
);

-- wound_sites: each anatomical wound location is a separate entity
CREATE TABLE wound_sites (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    foot_side TEXT NOT NULL CHECK (foot_side IN ('LEFT','RIGHT','BILATERAL')),
    location_on_foot TEXT NOT NULL CHECK (location_on_foot IN
        ('HEEL','FOREFOOT','TOE_1','TOE_2','TOE_3','TOE_4','TOE_5',
         'MIDFOOT','ANKLE','DORSUM','SOLE','OTHER')),
    toe_number INTEGER,  -- 1-5, only if location is TOE_n
    first_detected_date TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN
        ('ACTIVE','HEALED','AMPUTATED','TRANSFERRED_CARE','LOST_TO_FOLLOWUP')),
    healed_date TEXT,
    initial_wagner_grade INTEGER CHECK (initial_wagner_grade BETWEEN 0 AND 5),
    current_wagner_grade INTEGER CHECK (current_wagner_grade BETWEEN 0 AND 5),
    is_primary_site INTEGER DEFAULT 1,  -- primary or secondary wound
    notes TEXT,
    created_at TEXT NOT NULL,
    created_by_user_id TEXT REFERENCES users(id),
    last_session_at TEXT,
    total_sessions INTEGER DEFAULT 0
);

-- consents: versioned consent tracking per patient
CREATE TABLE consents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    consent_version TEXT NOT NULL,  -- '1.0', '1.1', '2.0'
    consent_type TEXT NOT NULL CHECK (consent_type IN
        ('STAGE1_RESEARCH','STAGE2_RESEARCH','COMMERCIAL','COMBINED')),
    signed_at TEXT NOT NULL,
    signed_by_method TEXT CHECK (signed_by_method IN ('DIGITAL_SIGNATURE','THUMBPRINT','VERBAL_WITNESSED')),
    witnessed_by_asha_id TEXT REFERENCES asha_workers(id),
    modules_consented TEXT NOT NULL,  -- JSON array: ['WOUND','SKIN','PALLOR','EYE_TRIAGE']
    withdrawal_at TEXT,
    withdrawal_reason TEXT,
    digital_signature_hash TEXT,
    consent_document_gcs_url TEXT,
    is_active INTEGER DEFAULT 1
);
```

### 4.3 Monitoring Session Tables

```sql
-- monitoring_sessions: every data submission event
CREATE TABLE monitoring_sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    wound_site_id TEXT REFERENCES wound_sites(id),  -- NULL for skin/eye sessions
    session_type TEXT NOT NULL CHECK (session_type IN
        ('WOUND_MONITORING','SKIN_ASSESSMENT','CONTRIBUTING_FACTOR',
         'RESEARCH_SCREENING','INITIAL_ASSESSMENT')),
    track TEXT NOT NULL CHECK (track IN ('RESEARCH','COMMERCIAL')),
    scheduled_date TEXT,  -- from session_schedule
    submitted_at TEXT,
    status TEXT DEFAULT 'SUBMITTED' CHECK (status IN
        ('SCHEDULED','SUBMITTED','AI_PROCESSING','AI_COMPLETE',
         'DOCTOR_REVIEWED','OVERDUE','SKIPPED','QUALITY_REJECTED',
         'CONFLICT_SECONDARY')),
    submitted_by_user_id TEXT REFERENCES users(id),
    submission_method TEXT CHECK (submission_method IN ('PATIENT_SELF','ASHA_ASSISTED')),
    is_offline_captured INTEGER DEFAULT 0,
    offline_captured_at TEXT,
    offline_uploaded_at TEXT,
    conflict_status TEXT DEFAULT 'NONE' CHECK (conflict_status IN
        ('NONE','DUPLICATE_PRIMARY','DUPLICATE_SECONDARY')),
    primary_session_id TEXT REFERENCES monitoring_sessions(id),  -- if secondary
    session_notes TEXT,
    ai_processing_started_at TEXT,
    ai_processing_completed_at TEXT
);

-- photographs: every photograph taken in any session
CREATE TABLE photographs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES monitoring_sessions(id),
    angle TEXT NOT NULL CHECK (angle IN
        ('TOP_DOWN','LEFT_45','RIGHT_45','MACRO_CLOSE',
         'EYE_FRONT','CONJUNCTIVA_LEFT','CONJUNCTIVA_RIGHT',
         'PERIWOUND_OVERVIEW','PERIWOUND_DETAIL',
         'SKIN_WEB_SPACE','SKIN_SOLE','SKIN_LOWER_LEG')),
    captured_at TEXT NOT NULL,  -- ISO 8601, from device clock
    device_id TEXT,
    gps_latitude REAL,   -- nullable, requires location permission
    gps_longitude REAL,
    gcs_url TEXT,        -- encrypted, full resolution
    thumbnail_gcs_url TEXT,
    file_size_bytes INTEGER,
    compressed_size_bytes INTEGER,
    resolution_width INTEGER,
    resolution_height INTEGER,
    quality_score REAL,  -- 0-100 from validation engine
    blur_score REAL,     -- lower = more blurred
    lighting_score REAL, -- 0-100
    coin_detected INTEGER,  -- 1=yes, 0=no, null=not applicable
    coin_center_x REAL,  -- pixel coordinates in original image
    coin_center_y REAL,
    coin_radius_pixels REAL,
    is_accepted INTEGER DEFAULT 1,
    rejection_reason TEXT,
    upload_status TEXT DEFAULT 'PENDING' CHECK (upload_status IN
        ('PENDING','UPLOADING','UPLOADED','FAILED')),
    upload_retry_count INTEGER DEFAULT 0,
    upload_error TEXT,
    sequence_number INTEGER  -- 1, 2, 3 within session
);

-- ai_results: complete AI output for each session
CREATE TABLE ai_results (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE REFERENCES monitoring_sessions(id),
    model_version TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    processing_method TEXT CHECK (processing_method IN
        ('ON_DEVICE','SERVER','GEMINI_FALLBACK','MANUAL_REVIEW')),
    overall_confidence REAL,  -- 0-1
    gemini_triggered INTEGER DEFAULT 0,
    processing_duration_ms INTEGER,

    -- Wound module outputs
    wound_area_cm2 REAL,
    wound_perimeter_cm REAL,
    wagner_grade INTEGER CHECK (wagner_grade BETWEEN 0 AND 5),
    wagner_confidence REAL,
    tissue_primary TEXT CHECK (tissue_primary IN
        ('GRANULATION','SLOUGH','ESCHAR','MIXED','HEALTHY_SKIN','INDETERMINATE')),
    granulation_pct REAL,
    slough_pct REAL,
    eschar_pct REAL,
    infection_probability REAL,  -- 0-1
    periwound_redness_mm REAL,
    spreading_redness_detected INTEGER DEFAULT 0,
    healing_rate_weekly_pct REAL,  -- positive = improving, negative = worsening
    predicted_closure_days INTEGER,

    -- Change from previous session (computed on server)
    area_change_pct REAL,        -- vs previous session same wound site
    grade_change INTEGER,         -- -1, 0, +1, +2 etc
    weeks_stalled INTEGER,        -- consecutive weeks without >5% improvement
    is_healing_on_track INTEGER,  -- 1=yes, 0=behind predicted, -1=stalled

    -- Skin module outputs
    skin_condition_primary TEXT,
    skin_condition_confidence REAL,
    skin_condition_secondary TEXT,
    maceration_detected INTEGER DEFAULT 0,
    cellulitis_spread_detected INTEGER DEFAULT 0,
    cellulitis_spread_mm REAL,
    psoriasis_pasi_estimate REAL,
    skin_wound_risk_level TEXT CHECK (skin_wound_risk_level IN
        ('LOW','MEDIUM','HIGH','CRITICAL')),
    treatment_recommendation TEXT,  -- JSON with medication details
    prescription_required INTEGER DEFAULT 0,  -- 0=OTC, 1=prescription needed

    -- Contributing factor outputs
    pallor_level TEXT CHECK (pallor_level IN
        ('NORMAL','MILD','SEVERE','INCONCLUSIVE')),
    pallor_confidence REAL,
    pallor_wound_implication TEXT,  -- clinical explanation of wound impact
    eye_urgency TEXT CHECK (eye_urgency IN
        ('URGENT','NON_URGENT','INCONCLUSIVE','NOT_ASSESSED')),
    eye_urgency_confidence REAL,
    eye_features_detected TEXT,  -- JSON array of detected features
    eye_action_required TEXT,

    -- Alert generated
    alert_level TEXT CHECK (alert_level IN ('GREEN','AMBER','RED')),
    alert_type TEXT,  -- primary reason for alert level
    alert_message_patient_en TEXT,
    alert_message_patient_bn TEXT,
    alert_message_doctor_en TEXT
);

-- alerts: every alert generated, with full escalation tracking
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES monitoring_sessions(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    wound_site_id TEXT REFERENCES wound_sites(id),
    alert_level TEXT NOT NULL CHECK (alert_level IN ('GREEN','AMBER','RED')),
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'WOUND_AREA_INCREASING','INFECTION_DETECTED','GRADE_INCREASE',
        'HEALING_STALLED','CELLULITIS_SPREADING','ESCHAR_DETECTED',
        'EYE_URGENT','PALLOR_SEVERE','OVERDUE_SUBMISSION',
        'QUALITY_REJECTED','SUBSCRIPTION_LAPSED')),
    generated_at TEXT NOT NULL,
    message_patient_en TEXT,
    message_patient_bn TEXT,
    message_doctor_en TEXT,
    -- Notification tracking
    patient_push_sent INTEGER DEFAULT 0,
    patient_push_sent_at TEXT,
    patient_sms_sent INTEGER DEFAULT 0,
    patient_sms_sent_at TEXT,
    doctor_push_sent INTEGER DEFAULT 0,
    doctor_sms_sent INTEGER DEFAULT 0,
    doctor_notified_at TEXT,
    -- Acknowledgement tracking
    doctor_acknowledged INTEGER DEFAULT 0,
    doctor_acknowledged_at TEXT,
    acknowledged_by_user_id TEXT REFERENCES users(id),
    acknowledgement_note TEXT,
    -- Escalation tracking
    escalation_level INTEGER DEFAULT 0,  -- 0=initial, 1=first escalation, 2=patient direct
    escalation_at TEXT,
    -- Resolution
    resolved_at TEXT,
    resolved_by_user_id TEXT REFERENCES users(id),
    resolution_action TEXT,
    resolution_notes TEXT
);
```

### 4.4 ASHA Worker Tables

```sql
-- asha_workers: extends the existing asha_workers table
-- ADD these columns to existing table:
-- asha_id_number, phc_name, block_name, district, villages_covered,
-- training_completed, training_completed_at, training_score,
-- bank_account_encrypted, bank_ifsc, supervisor_name, supervisor_phone
CREATE TABLE asha_workers (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    full_name TEXT NOT NULL,
    asha_id_number TEXT UNIQUE,  -- NHM official ASHA ID
    phone_number TEXT NOT NULL,
    phc_name TEXT NOT NULL,
    block_name TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT DEFAULT 'West Bengal',
    villages_covered TEXT NOT NULL,  -- JSON array of village names
    training_completed INTEGER DEFAULT 0,
    training_completed_at TEXT,
    training_score REAL,  -- 0-100
    supervisor_name TEXT,
    supervisor_phone TEXT,
    bank_account_encrypted TEXT,  -- AES encrypted
    bank_ifsc TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    total_screenings INTEGER DEFAULT 0,
    total_enrolments INTEGER DEFAULT 0
);

-- asha_patient_assignments: which ASHA is responsible for which patient
CREATE TABLE asha_patient_assignments (
    id TEXT PRIMARY KEY,
    asha_id TEXT NOT NULL REFERENCES asha_workers(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    assigned_at TEXT NOT NULL,
    assignment_type TEXT DEFAULT 'PRIMARY' CHECK (assignment_type IN ('PRIMARY','BACKUP')),
    is_active INTEGER DEFAULT 1,
    geographic_verified INTEGER DEFAULT 0,  -- 1 if patient village in ASHA coverage
    UNIQUE(asha_id, patient_id)
);

-- asha_commissions: every earning event
CREATE TABLE asha_commissions (
    id TEXT PRIMARY KEY,
    asha_id TEXT NOT NULL REFERENCES asha_workers(id),
    patient_id TEXT REFERENCES patients(id),
    session_id TEXT REFERENCES monitoring_sessions(id),
    commission_type TEXT NOT NULL CHECK (commission_type IN (
        'PATIENT_REGISTRATION',      -- Rs. 50
        'RESEARCH_SCREENING',        -- Rs. 30
        'MONITORING_SUBMISSION',     -- Rs. 20
        'COMMERCIAL_ENROLMENT',      -- Rs. 100
        'QUALITY_BONUS',             -- Rs. 10 (if quality score > 80)
        'MONTHLY_RETENTION_BONUS'    -- Rs. 200 (if patient active 3+ months)
    )),
    amount_rs REAL NOT NULL,
    earned_at TEXT NOT NULL,
    payment_status TEXT DEFAULT 'PENDING' CHECK (payment_status IN
        ('PENDING','APPROVED','PAID','HOLD','CANCELLED')),
    payment_date TEXT,
    payment_reference TEXT,
    notes TEXT
);

-- asha_training_modules: completion tracking per module
CREATE TABLE asha_training_modules (
    id TEXT PRIMARY KEY,
    asha_id TEXT NOT NULL REFERENCES asha_workers(id),
    module_code TEXT NOT NULL CHECK (module_code IN (
        'MODULE_WOUND_PHOTOGRAPHY',    -- How to photograph wounds
        'MODULE_COIN_PLACEMENT',       -- Coin reference placement
        'MODULE_SKIN_PHOTOGRAPHY',     -- Periwound skin photography
        'MODULE_EYE_PHOTOGRAPHY',      -- Conjunctival and anterior eye capture
        'MODULE_CONSENT_PROCESS',      -- Explaining consent in Bengali
        'MODULE_DATA_PRIVACY',         -- Patient data protection
        'MODULE_APP_OPERATION',        -- How to use the app
        'MODULE_REFERRAL_PROCESS'      -- When and how to refer patients
    )),
    completed_at TEXT,
    score REAL,        -- 0-100
    attempts INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,  -- 1 if score >= 70
    certificate_url TEXT,
    UNIQUE(asha_id, module_code)
);

-- Commission rates (reference, not a table — use in code constants):
-- PATIENT_REGISTRATION    = Rs. 50
-- RESEARCH_SCREENING      = Rs. 30
-- MONITORING_SUBMISSION   = Rs. 20
-- COMMERCIAL_ENROLMENT    = Rs. 100
-- QUALITY_BONUS           = Rs. 10 (quality_score > 80)
-- MONTHLY_RETENTION_BONUS = Rs. 200 (patient active >= 3 months)
```

### 4.5 Doctor and Clinical Tables

```sql
-- doctors: extends existing doctors table
CREATE TABLE doctors (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    full_name TEXT NOT NULL,
    nmc_registration_number TEXT UNIQUE NOT NULL,
    specialisation TEXT NOT NULL,
    hospital_name TEXT NOT NULL,
    hospital_department TEXT,
    hospital_address TEXT,
    consultation_phone TEXT NOT NULL,  -- doctor calls patient on this number
    available_days TEXT,  -- JSON array: ['MON','TUE','WED','THU','FRI']
    available_from TIME,
    available_until TIME,
    max_daily_consultations INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    onboarded_at TEXT,
    total_consultations INTEGER DEFAULT 0
);

-- doctor_patient_assignments
CREATE TABLE doctor_patient_assignments (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL REFERENCES doctors(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    wound_site_id TEXT REFERENCES wound_sites(id),  -- null = all wounds
    assigned_at TEXT NOT NULL,
    assignment_type TEXT DEFAULT 'PRIMARY' CHECK (assignment_type IN
        ('PRIMARY','COVERING','SPECIALIST_REFERRAL')),
    is_active INTEGER DEFAULT 1,
    assigned_by_admin_id TEXT,
    UNIQUE(doctor_id, patient_id)
);

-- teleconsult_requests
CREATE TABLE teleconsult_requests (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    session_id TEXT REFERENCES monitoring_sessions(id),
    alert_id TEXT REFERENCES alerts(id),
    request_type TEXT NOT NULL CHECK (request_type IN ('URGENT','ROUTINE','FOLLOW_UP')),
    requested_at TEXT NOT NULL,
    patient_concern_en TEXT,
    patient_concern_bn TEXT,
    preferred_callback_time TEXT,  -- ISO 8601 datetime
    status TEXT DEFAULT 'PENDING' CHECK (status IN (
        'PENDING','ASSIGNED','SCHEDULED','COMPLETED','CANCELLED','NO_SHOW','EXPIRED')),
    assigned_doctor_id TEXT REFERENCES doctors(id),
    assigned_at TEXT,
    scheduled_at TEXT,  -- confirmed callback datetime
    actual_call_at TEXT,
    call_duration_minutes INTEGER,
    doctor_notes TEXT,  -- entered in web dashboard
    patient_rating INTEGER CHECK (patient_rating BETWEEN 1 AND 5),
    patient_feedback TEXT
);

-- prescriptions: extends existing prescriptions table
CREATE TABLE prescriptions (
    id TEXT PRIMARY KEY,
    teleconsult_id TEXT REFERENCES teleconsult_requests(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    doctor_id TEXT NOT NULL REFERENCES doctors(id),
    wound_site_id TEXT REFERENCES wound_sites(id),
    issued_at TEXT NOT NULL,
    valid_until TEXT,
    medications TEXT NOT NULL,  -- JSON array: [{name, dose, frequency, duration, instructions, is_otc}]
    wound_care_instructions_en TEXT,
    wound_care_instructions_bn TEXT,
    dressing_type TEXT,
    dressing_change_frequency TEXT,
    referral_required INTEGER DEFAULT 0,
    referral_speciality TEXT,
    referral_urgency TEXT CHECK (referral_urgency IN ('ROUTINE','URGENT','EMERGENCY')),
    referral_reason TEXT,
    follow_up_days INTEGER,
    dietary_advice TEXT,
    shown_to_patient INTEGER DEFAULT 0,
    shown_at TEXT
);
```

### 4.6 Subscription and Payment Tables

```sql
-- subscription_tiers: the three pricing tiers
CREATE TABLE subscription_tiers (
    id TEXT PRIMARY KEY,
    tier_name TEXT NOT NULL CHECK (tier_name IN ('BASIC','STANDARD','PREMIUM')),
    price_monthly_rs REAL NOT NULL,
    price_annual_rs REAL,
    wound_sessions_per_month INTEGER,
    skin_sessions_per_month INTEGER,
    contributing_factor_sessions_per_quarter INTEGER,
    teleconsult_included_per_month INTEGER DEFAULT 0,
    features TEXT,  -- JSON array of feature flag strings
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- Tier data (seed this):
-- BASIC:    Rs. 299/month. Wound monitoring (4/month) + Skin (1/month). 0 teleconsult.
-- STANDARD: Rs. 499/month. All BASIC + Contributing factor (1/quarter). 1 teleconsult/month.
-- PREMIUM:  Rs. 799/month. All STANDARD. 2 teleconsult/month. Priority alerts.

-- subscriptions: patient subscription state machine
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    tier_id TEXT NOT NULL REFERENCES subscription_tiers(id),
    status TEXT NOT NULL DEFAULT 'TRIAL' CHECK (status IN (
        'TRIAL','ACTIVE','PAYMENT_FAILED','GRACE_PERIOD',
        'SUSPENDED','CANCELLED','EXPIRED','PAUSED')),
    -- Key dates
    trial_ends_at TEXT,
    started_at TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    next_billing_date TEXT,
    grace_period_ends_at TEXT,
    paused_at TEXT,
    pause_ends_at TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    -- Razorpay integration
    razorpay_subscription_id TEXT,
    razorpay_customer_id TEXT,
    -- Settings
    auto_renew INTEGER DEFAULT 1,
    amount_rs REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- payment_transactions
CREATE TABLE payment_transactions (
    id TEXT PRIMARY KEY,
    subscription_id TEXT REFERENCES subscriptions(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'SUBSCRIPTION_NEW','SUBSCRIPTION_RENEWAL','SUBSCRIPTION_UPGRADE',
        'TELECONSULT_ADHOC','ONE_TIME_SCREENING')),
    amount_rs REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN
        ('INITIATED','SUCCESS','FAILED','REFUNDED','PENDING_VERIFICATION')),
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    payment_method TEXT CHECK (payment_method IN
        ('UPI','CARD','NETBANKING','WALLET','CASH')),
    initiated_at TEXT NOT NULL,
    completed_at TEXT,
    failure_reason TEXT,
    receipt_gcs_url TEXT
);
```

### 4.7 Scheduling and Notification Tables

```sql
-- session_schedule: generated schedule for all expected submissions
CREATE TABLE session_schedule (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    wound_site_id TEXT REFERENCES wound_sites(id),
    session_type TEXT NOT NULL CHECK (session_type IN (
        'WOUND_MONITORING','SKIN_ASSESSMENT','CONTRIBUTING_FACTOR')),
    subscription_id TEXT REFERENCES subscriptions(id),
    scheduled_date TEXT NOT NULL,  -- YYYY-MM-DD
    due_by_date TEXT NOT NULL,     -- YYYY-MM-DD, typically 2 days after scheduled
    status TEXT DEFAULT 'UPCOMING' CHECK (status IN (
        'UPCOMING','DUE_TODAY','OVERDUE','COMPLETED','SKIPPED','CANCELLED')),
    reminder_1_sent_at TEXT,   -- 1 day before
    reminder_2_sent_at TEXT,   -- morning of due date
    overdue_alert_sent_at TEXT,
    completed_session_id TEXT REFERENCES monitoring_sessions(id),
    created_at TEXT NOT NULL
);

-- notifications
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    recipient_user_id TEXT NOT NULL REFERENCES users(id),
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'ALERT_RED','ALERT_AMBER','SESSION_DUE','SESSION_OVERDUE',
        'PRESCRIPTION_READY','TELECONSULT_SCHEDULED','TELECONSULT_CONFIRMED',
        'PAYMENT_DUE','PAYMENT_FAILED','PAYMENT_SUCCESS',
        'CONSENT_REQUIRED','SUBSCRIPTION_EXPIRING','SYSTEM_MESSAGE')),
    title_en TEXT NOT NULL,
    title_bn TEXT,
    body_en TEXT NOT NULL,
    body_bn TEXT,
    deep_link TEXT,  -- screen name + params for navigation on tap
    data TEXT,       -- JSON, additional payload
    channel TEXT NOT NULL CHECK (channel IN ('PUSH','SMS','BOTH')),
    sent_at TEXT NOT NULL,
    fcm_message_id TEXT,
    sms_message_id TEXT,
    read_at TEXT,
    action_taken INTEGER DEFAULT 0
);

-- notification_preferences: per-user notification settings
CREATE TABLE notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    session_reminder_days_before TEXT DEFAULT '[1]',  -- JSON array
    session_reminder_time TEXT DEFAULT '09:00',       -- HH:MM
    overdue_reminder_after_days INTEGER DEFAULT 2,
    alert_sms_enabled INTEGER DEFAULT 1,
    alert_push_enabled INTEGER DEFAULT 1,
    payment_notifications_enabled INTEGER DEFAULT 1,
    prescription_notifications_enabled INTEGER DEFAULT 1,
    marketing_enabled INTEGER DEFAULT 0,
    language TEXT DEFAULT 'en'
);
```

### 4.8 System Tables

```sql
-- audit_logs: every sensitive data access
-- This table already exists. Ensure it has these columns:
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action_type TEXT NOT NULL,  -- 'READ','CREATE','UPDATE','DELETE','LOGIN','EXPORT'
    table_affected TEXT,
    record_id TEXT,
    old_values TEXT,  -- JSON
    new_values TEXT,  -- JSON
    ip_address TEXT,
    device_id TEXT,
    timestamp TEXT NOT NULL,
    success INTEGER DEFAULT 1,
    failure_reason TEXT
);

-- research_exports: audit trail for data exports
CREATE TABLE research_exports (
    id TEXT PRIMARY KEY,
    exported_by_user_id TEXT NOT NULL REFERENCES users(id),
    export_type TEXT NOT NULL CHECK (export_type IN (
        'PILOT_PROGRESS','AI_PERFORMANCE','ASHA_COVERAGE',
        'EPIDEMIOLOGY','GRANT_REPORT','IEC_REPORT')),
    export_params TEXT,  -- JSON: date range, filters
    generated_at TEXT NOT NULL,
    record_count INTEGER,
    file_gcs_url TEXT,
    is_anonymised INTEGER DEFAULT 1,
    retention_days INTEGER DEFAULT 90
);

-- app_config: server-side configuration (no app update needed for changes)
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL
);
-- Seed app_config with:
-- 'min_app_version': '1.0.0' (below this, force update screen)
-- 'ai_confidence_threshold': '0.65' (below this, use Gemini)
-- 'max_photo_size_kb': '1200' (compress to this before upload)
-- 'alert_escalation_hours': '4' (RED alert unacknowledged escalation)
-- 'trial_days': '3'
-- 'grace_period_days': '7'
-- 'session_overdue_after_days': '2'
```

---

## 5. COMPLETE API SPECIFICATION

### 5.1 API Architecture

Base URL: http://10.0.2.2:5001/api (development)
Base URL: https://api.diabetescareai.in/api (production)

All endpoints require JWT Authorization header except auth endpoints.
All responses: { success: bool, data: {}, error: null | {code, message} }
All errors use standard HTTP status codes.
All timestamps: ISO 8601 string.

### 5.2 Authentication Endpoints

```
POST /auth/request-otp
Body: { phone_number }
Response: { otp_reference_id }
Note: Sends SMS OTP via Twilio. Rate limit: 3 per phone per hour.

POST /auth/verify-otp
Body: { phone_number, otp, otp_reference_id }
Response: { verified: true, is_new_user: bool }

POST /auth/register
Body: {
  phone_number, password, full_name, date_of_birth,
  gender, village, block, district, pin_code,
  emergency_contact_name, emergency_contact_phone,
  abha_id (optional), preferred_language,
  role: 'patient' | 'asha'
}
Response: { user_id, token, refresh_token }

POST /auth/login
Body: { phone_number, password }
Response: { user_id, role, token, refresh_token, profile }

POST /auth/refresh
Body: { refresh_token }
Response: { token, refresh_token }

POST /auth/logout
Body: {}
Response: { success: true }

PUT /auth/change-password
Body: { current_password, new_password }
Response: { success: true }

POST /auth/forgot-password
Body: { phone_number }
Response: { otp_reference_id }
```

### 5.3 Patient Endpoints

```
GET  /patients/me
Response: full patient profile including latest medical history

PUT  /patients/me
Body: updatable fields (village, emergency contact, language, etc.)

POST /patients/me/medical-history
Body: { diabetes_type, diabetes_duration_years, hba1c_value,
        hba1c_date, has_hypertension, has_ckd, has_cad,
        previous_dfu, current_medications, smoking_status,
        bmi, weight_kg, bp_systolic, bp_diastolic, notes }
Response: { medical_history_id, version_number }

GET  /patients/me/medical-history
Response: { current: {}, history: [] }

POST /patients/me/consent
Body: { consent_version, consent_type, signed_by_method,
        modules_consented, digital_signature_hash }
Response: { consent_id }

GET  /patients/me/consents
Response: [ list of consent records, active first ]

GET  /patients/me/dashboard
Response: {
  active_wound_sites: [],
  sessions_due_today: [],
  sessions_overdue: [],
  subscription_status: {},
  recent_alerts: [],
  upcoming_teleconsult: {}
}
```

### 5.4 Wound Site Endpoints

```
GET  /patients/me/wound-sites
Response: [ all wound sites, active first ]

POST /patients/me/wound-sites
Body: { foot_side, location_on_foot, toe_number,
        first_detected_date, initial_wagner_grade, notes }
Response: { wound_site_id }

PUT  /patients/me/wound-sites/:id
Body: updatable fields (status, notes, healed_date)

GET  /patients/me/wound-sites/:id/history
Response: {
  wound_site: {},
  sessions: [],
  measurements: [],      -- area over time
  grade_history: [],     -- grade over time
  alert_history: [],
  predicted_closure: {}
}
```

### 5.5 Monitoring Session Endpoints

```
POST /sessions
Body: {
  patient_id, wound_site_id (nullable), session_type,
  track, scheduled_date, submission_method,
  is_offline_captured, offline_captured_at
}
Response: { session_id }

POST /sessions/:id/photographs
Body: multipart/form-data {
  photo: [file], angle, captured_at, coin_detected,
  coin_center_x, coin_center_y, coin_radius_pixels,
  quality_score, gps_latitude, gps_longitude, sequence_number
}
Response: { photograph_id, upload_status }
Note: Photo is compressed client-side to max 1200KB before upload.

POST /sessions/:id/submit
Body: { session_notes }
Response: { session_id, status: 'AI_PROCESSING' }
Note: Triggers async AI processing pipeline.

GET  /sessions/:id
Response: { session: {}, photographs: [], ai_result: {} }

GET  /sessions/:id/result
Response: { ai_result: {}, alert: {}, recommendations: {} }
Note: Poll every 3 seconds until status != 'AI_PROCESSING'

GET  /patients/:id/sessions
Query: session_type, from_date, to_date, wound_site_id
Response: [ sessions list ]
```

### 5.6 Schedule Endpoints

```
GET  /patients/me/schedule
Query: from_date, to_date
Response: {
  due_today: [],
  upcoming_7_days: [],
  overdue: []
}

PUT  /schedule/:id/skip
Body: { reason }
Response: { success: true }
```

### 5.7 Alert Endpoints

```
GET  /patients/me/alerts
Query: resolved (bool), alert_level, limit
Response: [ alerts list ]

PUT  /alerts/:id/acknowledge
Body: { note }
Response: { success: true }
Note: For doctor use via web dashboard.
```

### 5.8 Teleconsult Endpoints

```
POST /teleconsults
Body: {
  session_id (nullable), alert_id (nullable),
  request_type, patient_concern_en, patient_concern_bn,
  preferred_callback_time
}
Response: { teleconsult_id, estimated_callback_time }

GET  /teleconsults/me
Query: status
Response: [ teleconsult list ]

GET  /teleconsults/:id
Response: full teleconsult with prescription if issued

PUT  /teleconsults/:id/rate
Body: { rating (1-5), feedback }
Response: { success: true }
```

### 5.9 Subscription and Payment Endpoints

```
GET  /subscriptions/tiers
Response: [ all active tiers with features ]

GET  /subscriptions/me
Response: current subscription state

POST /subscriptions
Body: { tier_id }
Response: { subscription_id, razorpay_order: {} }

POST /subscriptions/me/upgrade
Body: { new_tier_id }
Response: { razorpay_order: {} }

POST /subscriptions/me/pause
Body: { pause_days (max 30) }
Response: { pause_ends_at }

POST /subscriptions/me/cancel
Body: { reason }
Response: { cancelled_at }

POST /payments/verify
Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
Response: { success: true, subscription_active: true }

GET  /payments/history
Response: [ transaction list ]
```

### 5.10 ASHA Endpoints

```
POST /asha/login
Body: { phone_number, password }
Response: { user_id, token, asha_profile }

GET  /asha/me
Response: full ASHA profile with training status

GET  /asha/patients
Response: [ patients in ASHA's geographic area ]
Note: Filtered by villages_covered at query level.

POST /asha/patients/search
Body: { phone_number }
Response: { found: bool, patient: {} | null }
Note: Check before registering — prevents duplicates.

POST /asha/patients
Body: { all patient registration fields }
Response: { patient_id }
Note: Also creates asha_patient_assignment record.

POST /asha/sessions
Body: { same as POST /sessions but with patient_id }
Response: { session_id }

GET  /asha/schedule/today
Response: [ patients due for monitoring today in ASHA area ]

GET  /asha/commissions
Query: from_date, to_date
Response: { total_earned, pending, paid, breakdown: [] }

GET  /asha/training-status
Response: { modules: [], all_complete: bool, overall_score }

POST /asha/training/:module_code/complete
Body: { score }
Response: { passed: bool, certificate_url }
```

### 5.11 Prescription Endpoints

```
GET  /patients/me/prescriptions
Response: [ prescriptions, newest first ]

GET  /prescriptions/:id
Response: full prescription with medications and instructions
```

### 5.12 Notification Endpoints

```
GET  /notifications/me
Query: unread_only (bool), limit
Response: [ notifications ]

PUT  /notifications/:id/read
Response: { success: true }

GET  /notifications/preferences
Response: current preferences

PUT  /notifications/preferences
Body: updatable preference fields
Response: { success: true }

POST /notifications/device-token
Body: { fcm_token }
Response: { success: true }
```

---

## 6. COMPLETE SCREEN SPECIFICATIONS

For each screen, the spec lists:
- Purpose
- Who sees it (Patient / ASHA)
- Props received (from previous screen)
- State variables
- API calls made
- Key UI elements
- Navigation on actions

Use this colour palette throughout:
- Primary: #1A3A5C (navy blue)
- Secondary: #2463AE (blue)
- Success: #0D6B55 (teal)
- Warning: #E67E00 (amber)
- Danger: #7B1818 (red)
- Background: #F4F8FC (light blue-grey)
- Card background: #FFFFFF
- Text primary: #0F0F0F
- Text secondary: #5A5A5A
- Border: #D4D9E0
- Highlight green: #E8F3DC
- Highlight amber: #FEF3E2
- Highlight red: #FBE8E8

Font: System default. Bold for headings, regular for body.
All touch targets: minimum 48×48dp.
All forms: real-time validation, error shown below field in red.

---

### PATIENT SCREENS

---

**P1: SplashScreen** ✅ EXISTS — no changes needed
Shows logo, checks auth token, routes to PatientHome or RoleSelect.

---

**P2: RoleSelect** ✅ EXISTS — no changes needed

---

**P3: PatientLogin** 🟡 MODIFY
Add: biometric login option (react-native-biometrics).
Add: "Forgot password" link → OTP reset flow.
Keep: existing phone/password form.

New behaviour:
- On app launch after first login: show fingerprint prompt first
- If fingerprint fails or not enrolled: show password form
- "Login with OTP" option for users who forget password

---

**P4: PatientRegistration** 🟡 MODIFY existing screen
Add fields to existing registration form:
- Date of birth (date picker)
- Emergency contact name (text)
- Emergency contact phone (phone input)
- ABHA ID (text, optional, label: "Ayushman Bharat Health Account ID")
- Language preference toggle (English / বাংলা)

Keep all existing fields.

After registration, automatically navigate to P5 (MedicalHistorySetup).

---

**P5: MedicalHistorySetup** 🔴 NEW SCREEN
Purpose: Collect baseline medical history at registration.
Shows after P4, before ConsentScreen.
Can be skipped (all fields optional) but shows reminder if skipped.

Fields:
- Diabetes type: radio buttons (Type 1 / Type 2 / Not sure)
- Years with diabetes: number input
- Last HbA1c value: number input (optional, with "% " suffix)
- Last HbA1c date: date picker (optional)
- Do you have high blood pressure? Toggle Yes/No
- Do you have kidney disease? Toggle Yes/No
- Have you had a foot wound before? Toggle Yes/No
- If yes: how many times? number input
- Have you ever had an amputation? Toggle Yes/No
- Current diabetes medications: multi-select chips
  (Metformin, Insulin, Glipizide, Sitagliptin, Empagliflozin, Other)
- Do you smoke? Radio (Never / Former / Current)

Navigation: "Save and Continue" → ConsentScreen

---

**P6: ConsentScreen** 🟡 MODIFY existing
Changes:
- Display consent version number (e.g., "Version 1.0 — Research Study Stage 1")
- List modules explicitly: "This study involves: Wound photographs, Eye photographs for anaemia assessment"
- Add signature pad (react-native-signature-canvas library)
  OR thumbprint option with text: "Sign below OR tap 'Thumbprint Consent' if you cannot sign"
- If ASHA-assisted: show field "ASHA Worker Name" auto-filled from ASHA login
- Store: consent_version, signed_by_method, modules_consented, digital_signature_hash
- After consent: check if medical history was skipped → if skipped, show brief reminder

---

**P7: PatientHome** 🟡 REDESIGN
Purpose: Central dashboard showing everything the patient needs to know.

Sections (cards, stacked vertically, scrollable):

1. SUBSCRIPTION STATUS CARD
   - If no subscription: "Start Free Trial" button → SubscriptionManager (P28)
   - If TRIAL: "Free trial: X days remaining. Subscribe to continue."
   - If ACTIVE: show tier name, next billing date
   - If SUSPENDED: yellow warning "Monitoring paused — payment needed"

2. MY WOUNDS (shown if 1+ active wound sites)
   - One card per active wound site
   - Shows: foot side + location label, last session date, last AI result (GREEN/AMBER/RED dot)
   - "Photograph today" button if session due (highlighted if overdue)
   - "View history" link
   - "Add new wound site" button if < 5 active sites

3. TODAY'S TASKS
   - List of sessions_due_today from session_schedule
   - Each item: module name, wound site (if wound), "Do now" button
   - Overdue items shown in amber/red

4. RECENT ALERTS (shown if any unresolved AMBER or RED)
   - Last 3 alerts, newest first
   - Tap to see full result

5. UPCOMING TELECONSULT
   - If scheduled: doctor name, date/time, phone number to expect call from
   - "Cancel" option

6. QUICK LINKS
   - My Prescriptions
   - Book Teleconsult
   - My Progress Report
   - Notification Settings

---

**P8: WoundSiteSelector** 🔴 NEW SCREEN
Purpose: Interactive foot diagram to select wound location.

Display:
- Title: "Select wound location"
- Two feet shown (left and right), plantar (sole) view
- SVG foot diagram with tap zones for each location:
  - Heel (large zone, posterior)
  - Forefoot (anterior pad)
  - Toe 1-5 (individual toe tips)
  - Midfoot (arch area)
  - Ankle
  - Dorsum (note: "flip to dorsal view" toggle)
- Tap a zone → highlights it, shows confirmation: "Left Heel — is this correct?"
- "Add this wound site" button
- "My existing wound sites" section below diagram (list of active sites, tap to select)
- "Back" navigates to PatientHome

Props: { onSiteSelected: (wound_site_id) => void }
On new site: POST /patients/me/wound-sites, then navigate to WoundMonitorHome

---

**P9: WoundMonitorHome** 🔴 NEW SCREEN
Purpose: Per-wound-site monitoring dashboard.

Props: { wound_site_id, wound_site_label }

Display:
1. Wound location header (e.g., "Left Heel Wound")
2. Area Trend Chart (line chart, last 8 sessions)
   - X axis: date, Y axis: area in cm²
   - Points coloured: green (healing), amber (stalled), red (worsening)
   - If < 2 sessions: show "Take your first 2 photographs to see your healing trend"
3. This Week's Status card:
   - Last session: date + AI result summary
   - GREEN/AMBER/RED status badge
   - If RED: "ACTION NEEDED" in red with what to do
4. Next session due:
   - "Next photograph due: [date]" or "DUE TODAY" or "OVERDUE by X days"
   - "Photograph now" button (primary action)
5. Wound Statistics:
   - First detected: [date]
   - Weeks monitored: [n]
   - Area change total: +X% / -X%
   - Wagner Grade: [n] (from latest session)
6. "View full history" button → WoundHistoryScreen (P16)

---

**P10: WoundSessionGuide** 🔴 NEW SCREEN
Purpose: Step-by-step guide before photograph capture.

Steps shown as numbered cards the patient swipes through:

Step 1: "Clean the area"
"Gently clean around the wound with clean water. Pat dry."
[Illustration: clean cloth and water]

Step 2: "Find good lighting"
"Sit near a window or in a bright room. Turn on room lights."
[Illustration: window with sunlight]

Step 3: "Place the coin"
"Place a 1 rupee coin flat on the skin next to your wound, touching the wound edge."
[Illustration: coin placement diagram]
Tap "Show me how" → CoinPlacementGuide (P11) as modal

Step 4: "Take 3 photographs"
"We will take 3 photographs — from the top, from the left, from the right."
[Illustration: three camera angles]

"I'm ready — start photographing" button → CameraScreen (P12)

---

**P11: CoinPlacementGuide** 🔴 NEW SCREEN (Modal)
Purpose: Visual guide for coin placement.

Shows:
- Large illustration: top-down view of foot wound with 1 rupee coin placed correctly
- "Correct" example with green checkmark: coin flat on skin, touching wound edge
- "Wrong" examples with red X: coin overlapping wound, coin not touching wound, coin on edge
- "The app will check that the coin is visible. If it cannot see the coin, it will ask you to try again."
- "Got it" button dismisses modal

---

**P12: CameraScreen** 🟡 MAJOR REWORK
Purpose: Photograph capture with real-time quality validation.

Current version: basic camera capture.

New version must add:

1. Angle indicator overlay:
   - Three tabs at top: "Top-down" | "Left side" | "Right side"
   - Currently active angle highlighted
   - Silhouette guide overlay showing correct framing

2. Real-time quality overlays (QualityValidationOverlay — P13):
   - Blur indicator: "HOLD STEADY" in red if blurred
   - Lighting: "TOO DARK — move to brighter area" if underexposed
   - Distance: "TOO FAR — move closer" if wound too small in frame
   - For wound sessions only: "COIN NOT VISIBLE — check coin placement" if coin not detected

3. Capture button:
   - Disabled (grey) when quality checks fail
   - Enabled (primary blue) when all checks pass
   - Shows brief green flash on successful capture

4. Review strip at bottom:
   - Shows captured photos as small thumbnails (1, 2, 3 slots)
   - Green checkmark on captured, empty circle on remaining
   - Tap existing thumbnail → retake option

5. After all 3 photos captured: "Review photos" button → PhotoReviewScreen (P14)

Props: {
  session_type,  -- determines which overlays to show
  angle_sequence,  -- ['TOP_DOWN','LEFT_45','RIGHT_45'] for wound
  on_all_captured: (photographs) => void
}

---

**P13: QualityValidationOverlay** 🔴 NEW COMPONENT (not a full screen)
Purpose: Real-time camera quality feedback overlay.

This is a View component rendered ON TOP of the camera preview.

Shows when conditions are not met:
- Red translucent banner at top of viewfinder
- Icon + short text message
- Dismiss automatically when condition is fixed

Quality checks (run at ~10fps using frame processor or quality check API):
- blur_score < 40: "Hold steady — image is blurred"
- lighting_score < 30: "Too dark — find better lighting"
- lighting_score > 95: "Too bright — avoid direct flash on wound"
- wound_coverage < 30% of frame: "Move closer to the wound"
- coin_detected = false (for wound sessions): "Place 1 rupee coin next to wound"
- multiple coins detected: "Use only one coin as reference"

Green "✓ Good" badge when all checks pass.

---

**P14: PhotoReviewScreen** 🔴 NEW SCREEN
Purpose: Review all photographs before submission.

Shows:
- Three photos in a row (or scrollable if small screen)
- Each photo: angle label, quality score badge (Good/Fair/Retake)
- Tap any photo → full screen preview with "Retake this photo" button
- Warning if any photo has quality_score < 50:
  "Photo 2 quality is low. Consider retaking for better AI results."
- "Submit photographs" (primary button) — always enabled, patient can submit even low quality
- "Retake all" (secondary button)

On submit: POST /sessions, then POST /sessions/:id/photographs (×3), then POST /sessions/:id/submit
Show loading spinner with message "Analysing your wound photographs..."
On AI complete: navigate to WoundResultScreen (P15)
If offline: show "Photographs saved. Will analyse when connected." → queue for upload

---

**P15: WoundResultScreen** 🟡 REWORK existing ResultScreen for wound module
Props: { session_id, wound_site_id }

Sections:

1. ALERT LEVEL BANNER (full width, coloured)
   - GREEN: "Your wound is healing well this week ✓"
   - AMBER: "Your wound needs attention — talk to your doctor soon"
   - RED: "URGENT — your wound needs care today"

2. KEY MEASUREMENTS (cards in a 2×2 grid)
   - Wound area: "[X.X cm²]" with up/down arrow vs last week
   - Wagner Grade: "[Grade N]" with change indicator
   - Tissue: "[primary tissue type]" with colour dot
   - Infection risk: "[LOW/MEDIUM/HIGH]" with percentage

3. HEALING PROGRESS (mini chart)
   - Area trend last 4 sessions
   - "Improving ↓" or "Stalling →" or "Worsening ↑" label

4. AI OBSERVATIONS (bullet list, plain language)
   Generated from ai_result fields. Examples:
   - "Your wound area decreased by 12% this week — this is good progress"
   - "Yellow tissue (slough) is present — your doctor may recommend debridement"
   - "We detected spreading redness around your wound — this may indicate infection"

5. WHAT TO DO NEXT
   - GREEN: "Continue your current treatment. Next check: [date]"
   - AMBER: "Contact your doctor or clinic within the next 2-3 days"
   - RED: "Please seek medical care today. Tap below to call your doctor."

6. ACTION BUTTONS
   - GREEN: "Back to home"
   - AMBER: "Book teleconsult" + "Back to home"
   - RED: "CALL DOCTOR NOW" (dials consultation_phone) + "Book emergency teleconsult"

---

**P16: WoundHistoryScreen** 🔴 NEW SCREEN
Purpose: Full historical view of all sessions for one wound site.

Props: { wound_site_id }

Sections:

1. Wound info header (site label, first detected, weeks monitored)

2. HEALING CHART (full width, tall)
   - Line chart: wound area over all sessions
   - Points coloured by alert level
   - Tap point → mini card shows that session's details

3. STATISTICS SUMMARY
   - Total area reduction: X%
   - Best healing week: X% reduction
   - Average weekly healing rate
   - Predicted closure: [date] or "Trend unclear — more data needed"

4. SESSION HISTORY (chronological list, newest first)
   Each item shows:
   - Date, alert level badge
   - Area + grade
   - Thumbnail of top-down photograph
   - Tap → WoundResultScreen for that session

---

**P17: SkinMonitorHome** 🔴 NEW SCREEN
Purpose: Monthly skin assessment hub.

Sections:
1. Last assessment summary (date, conditions found, treatment given)
2. Next assessment due date (or "Due today" / "Overdue")
3. Any active skin findings (ongoing conditions flagged in previous sessions)
4. "Start skin assessment" button → SkinSessionGuide (P18)
5. History: list of past sessions

---

**P18: SkinSessionGuide** 🔴 NEW SCREEN
Purpose: Guide patient to photograph the right areas.

Steps:
1. "Web spaces between toes" — guide illustration + camera button
2. "Sole of the foot" — guide + camera
3. "Around and near the wound" — guide + camera
4. "Lower leg skin" — guide + camera (optional if no lower leg involvement)

Each step: brief instruction + illustration + camera capture.
Uses the same CameraScreen (P12) with skin-specific overlays (no coin needed).
After all areas photographed: PhotoReviewScreen (P14) → SkinResultScreen (P19)

---

**P19: SkinResultScreen** 🔴 NEW SCREEN
Purpose: Skin AI analysis results.

Sections:
1. Alert level banner (wound risk implication)
2. Conditions found (each as a card):
   - Condition name (e.g., "Fungal infection — web space")
   - Wound risk implication ("This increases your wound infection risk")
   - Treatment guidance:
     - OTC: specific medication name, dose, duration
     - Prescription needed: "You need a prescription for this — book a teleconsult"
3. What to watch for (warning signs)
4. Next assessment due date
5. Action buttons

---

**P20: ContributingFactorHome** 🔴 NEW SCREEN
Purpose: Quarterly contributing factor triage hub.

Sections:
1. Explanation card: "We check two things that can slow wound healing:
   your blood levels (anaemia) and your eye health."
2. Last assessment date and result
3. PALLOR ASSESSMENT card:
   - Brief explanation: "Low blood level (anaemia) can stop wounds from healing"
   - "Assess now" button → PallorCaptureGuide (P21)
4. EYE TRIAGE card:
   - Brief explanation: "Urgent eye conditions can prevent you caring for your wound"
   - Toggle: "Do you have a red or painful eye today?" (Yes/No)
   - If Yes: "Assess now" button → RedEyeCapture (P22)
   - If No: "No eye symptoms" confirmed, only pallor assessment this session
5. Next assessment due date

---

**P21: PallorCaptureGuide** 🔴 NEW SCREEN
Purpose: Guide for conjunctival pallor photograph.

Pre-capture screening question (MANDATORY before photograph):
"Do you have any of these eye symptoms today?"
Checkboxes: Red eye / Discharge / Itching / Painful eye / Blurred vision
If ANY checked → do not proceed with pallor assessment for this eye.
Show: "Your eye symptoms today may affect this test. Please use the eye
triage instead." → RedEyeCapture (P22)

If no symptoms checked, proceed to guide:

Step 1: "Use good lighting — sit facing a bright light source"
Step 2: "With clean hands, gently pull your lower eyelid down"
Step 3: "Hold your phone 15-20cm from your eye"
Step 4: "Take the photograph" — camera opens, flash ON automatically

After capture: POST session + photograph, wait for AI result → ContributingFactorResult (P23)

---

**P22: RedEyeCapture** 🔴 NEW SCREEN
Purpose: Capture anterior eye photograph for urgency triage.

Brief explanation: "We will check if your eye condition needs urgent treatment today."

Disclaimers (prominent):
"This assessment checks the OUTSIDE of your eye only.
It does NOT check your retina or the inside of your eye.
If you have diabetes, please ask your doctor about a separate retina check."

Guide:
- Open eye wide, look straight at camera
- Phone at arm's length
- Room light on, no direct flash on eye
- "Take photograph" → CameraScreen with eye-specific overlay

After capture: POST to session → ContributingFactorResult (P23)

---

**P23: ContributingFactorResult** 🔴 NEW SCREEN
Purpose: Show pallor and eye triage results.

Pallor section:
- NORMAL: "Your blood level appears adequate. Anaemia is unlikely affecting your wound healing."
- MILD: "Your blood level may be slightly low. Consider asking your doctor for a blood test."
- SEVERE: "Your blood level appears low. Low blood levels can significantly slow wound healing. A blood test is recommended urgently."

Eye triage section (if assessed):
- NON-URGENT: condition name + home care guidance
- URGENT: "Your eye needs same-day specialist attention. This may also affect your ability to care for your wound." + "Find nearest eye hospital" button + "Book teleconsult" button

Wound connection explanation:
Brief clinical note: "How this relates to your wound: [AI-generated contextual explanation]"

---

**P24: ConsultRequest** 🟡 MODIFY existing
Changes:
- Add: session_id field (auto-filled when coming from a result screen)
- Add: alert_id field (auto-filled when coming from an alert)
- Add: specific question field (free text, multilingual)
- Add: preferred callback time picker
Keep all existing functionality.

---

**P25: QueueStatus** 🟡 MODIFY existing
Changes:
- Show scheduled callback time (not just queue position)
- Show: "Dr. [Name] will call you at [time] on [phone number]"
- Show: "Make sure your phone is on and not on silent at this time"
- Cancel option (if >2 hours until scheduled call)

---

**P26: TeleconsultComplete** 🔴 NEW SCREEN
Purpose: Post-call screen shown after teleconsult marked complete.

Sections:
1. "Your consultation is complete"
2. If prescription issued: prescription preview card
   - Tap to view full PrescriptionDetail (P30)
3. Rating: "How was your consultation?" 1-5 stars
4. Optional feedback text
5. "Return home" button

---

**P27: PatientProfile** 🟡 MODIFY existing
Add 4th tab: "Medical" (existing tabs: History, Rx, Progress)

Medical tab:
- Current values: diabetes duration, HbA1c, medications
- "Update medical history" button → MedicalHistorySetup as a modal
- History: show previous versions with dates

Subscription tab (add to existing):
- Current plan, status, next billing
- "Manage subscription" → SubscriptionManager (P28)

---

**P28: SubscriptionManager** 🔴 NEW SCREEN
Purpose: Subscription management.

Sections:
1. CURRENT PLAN (if subscribed):
   - Tier name, price, status
   - Features list (what's included)
   - Next billing date / days until renewal

2. AVAILABLE PLANS (3 cards):
   BASIC (Rs. 299/month):
   - Weekly wound monitoring (4 sessions/month)
   - Monthly skin assessment
   - PDF healing reports
   - Email/SMS alerts

   STANDARD (Rs. 499/month):
   - Everything in Basic
   - Quarterly contributing factor triage
   - 1 free teleconsult/month
   - Doctor dashboard access

   PREMIUM (Rs. 799/month):
   - Everything in Standard
   - 2 teleconsults/month
   - Priority alert handling
   - Monthly HbA1c correlation report

3. Actions:
   - Subscribe / Upgrade / Downgrade → PaymentScreen (P29)
   - Pause subscription (max 30 days)
   - Cancel subscription (confirmation required)

4. BILLING HISTORY (last 6 transactions)

---

**P29: PaymentScreen** 🔴 NEW SCREEN
Purpose: UPI/card payment via Razorpay.

Shows:
- Order summary: plan name, amount, billing period
- Payment method selection: UPI / Card / Net Banking
- Razorpay SDK WebView for actual payment
- On success: navigate to PatientHome with "Subscription activated!" toast
- On failure: show error, option to retry or change payment method

Implementation: Use Razorpay React Native SDK.
POST /subscriptions to get Razorpay order, open Razorpay checkout,
on success POST /payments/verify.

---

**P30: PrescriptionDetail** 🟡 MODIFY existing
Changes:
- Show wound care instructions (separate from medication list)
- Show dressing instructions if provided
- Show referral details if referral_required = true
- Add "Share with pharmacist" button (generates PDF)
- Show "Valid until" date

---

**P31: NotificationSettings** 🔴 NEW SCREEN
Purpose: Manage notification preferences.

Sections:
1. Language: English / বাংলা toggle
2. Session reminders:
   - "Remind me X days before" — toggle list (1 day, 3 days)
   - "Reminder time" — time picker
3. Overdue reminders: toggle on/off, days before escalation
4. Alert notifications: SMS toggle, Push notification toggle
5. Payment reminders: toggle
6. "Save preferences" button

---

**P32: ProgressReport** 🔴 NEW SCREEN
Purpose: Exportable healing summary.

Shows:
- Patient name, wound site, date range
- Area trend chart (printable)
- Session summary table
- Current status
- "Generate PDF" button → triggers server-side PDF generation
- "Share PDF" button (to WhatsApp, email, etc.)
Note: PDF is generated server-side at GET /sessions/:wound_site_id/report

---

**P33: DataPrivacySettings** 🔴 NEW SCREEN
Purpose: DPDP Act 2023 compliance.

Sections:
1. "What data we store" — plain language list
2. "Request your data" button → download link (generated server-side, emailed)
3. "Delete my account" button → confirmation modal with consequences explained
4. "Withdraw consent" section — shows current consents, allows withdrawal
5. Link to privacy policy URL

---

### ASHA SCREENS

---

**A1: AshaLogin** ✅ EXISTS — add biometric option same as P3

**A2: AshaHome** 🟡 REDESIGN
Sections:
1. Greeting: "Good morning, [Name]"
2. TODAY'S TASKS:
   - [N] patients due for monitoring today
   - [N] pending registrations to complete
   - [N] photographs in offline queue
3. QUICK ACTIONS:
   - "Register new patient" → A7 (search first)
   - "Screen a patient" → A5 (patient list)
   - "View offline queue" → A16
4. SUMMARY STATS:
   - Patients registered this month
   - Screenings this month
   - Commission earned this month
5. Training status banner (if not all complete): "Complete your training to screen patients"

---

**A3: AshaPatientRegister** 🟡 MODIFY existing
Add to existing form:
- Date of birth
- Emergency contact
- Block name, district
- ABHA ID (optional)
After registration: guide ASHA through MedicalHistorySetup on behalf of patient
Then: AshaConsentCapture (A4)

---

**A4: AshaConsentCapture** 🟡 MODIFY existing ConsentScreen
ASHA-specific version:
- Displays Bengali consent script in full (for ASHA to read aloud)
- "Read this to the patient" header
- Patient signs/thumbprints
- ASHA confirms as witness
- Records: signed_by_method (VERBAL_WITNESSED or THUMBPRINT), witnessed_by_asha_id

---

**A5: AshaPatientList** 🔴 NEW SCREEN
Purpose: View all patients in ASHA's catchment area.

Shows for each patient:
- Name, village, last screening date
- Active wound sites count
- Subscription status badge
- Alert status badge (RED dot if any active RED alert)

Filters: All / Due today / Overdue / New (no screening yet)
Search: by name or phone

Tap patient → two options: "Screen this patient" or "View patient"

---

**A6: AshaConditionSelector** ✅ EXISTS — MODIFY
Changes:
- Show available modules based on patient's consent version
- Locked modules shown with padlock icon and "Consent not given" label
- Add "Wound monitoring session" option (distinct from research screening)
- Show last session date per module

---

**A7: AshaPatientSearch** 🔴 NEW SCREEN
Purpose: Search before registering to prevent duplicates.

Shows before AshaPatientRegister.
Search by: phone number (primary) or name + village

If patient found:
- Show patient card (name, village, registration date)
- "This patient is already registered" message
- "Screen this patient" button
- "This is a different patient" option (shows warning about duplicates)

If not found:
- "No matching patient found"
- "Register new patient" button → A3

---

**A8: AshaScreeningCamera** 🟡 SAME as P12
No separate screen needed. Use CameraScreen with submission_method='ASHA_ASSISTED'

---

**A9: AshaScreeningResult** 🟡 MODIFY existing ResultScreen for ASHA
ASHA sees:
- Risk level: HIGH / MEDIUM / LOW (not full AI details)
- Recommended action: refer to PHC / self-treat with OTC / monitor
- Referral required: YES/NO
If YES → "Generate referral slip" button → A17

---

**A10: AshaEnrollMonitoring** 🔴 NEW SCREEN
Purpose: Enrol research patient in commercial subscription.

Shows:
- Subscription tiers with prices
- "What the patient gets" (features in simple Bengali)
- Payment options: patient pays on own phone / ASHA collects cash (not in app)
- "Patient wants to subscribe" → guide to PaymentScreen on patient's phone
- "Patient will subscribe later" → set reminder in session_schedule

---

**A11: AshaWoundSiteSetup** 🔴 NEW SCREEN
Purpose: ASHA records wound site details for a patient.
Same as P8 (WoundSiteSelector) but ASHA is selecting on behalf of patient.

---

**A12: AshaMonitoringSession** 🔴 NEW SCREEN
Purpose: ASHA-assisted wound monitoring session.
Walks through: WoundSessionGuide → CameraScreen → PhotoReviewScreen
Submission method: 'ASHA_ASSISTED', offline if no connectivity.

---

**A13: AshaTrainingHome** 🔴 NEW SCREEN
Purpose: Training module list and completion status.

Shows each module as a card:
- Module name, description, estimated time
- Status: Completed (green) / In Progress (amber) / Not started (grey)
- Score if completed
- "Start" or "Review" button

Locked: cannot access patient screens until ALL modules marked passed (score >= 70).

---

**A14: AshaTrainingModule** 🔴 NEW SCREEN
Purpose: Each individual training module.

Structure:
1. Video or illustrated content (loaded from GCS URL)
2. Key points summary
3. Quiz (3-5 questions, multiple choice)
4. Submit quiz → score shown → passed (green) or failed (red, retry)
5. Certificate generated server-side if passed

Module content URLs stored in app_config table, updateable server-side.

---

**A15: AshaCommissionDashboard** 🔴 NEW SCREEN
Purpose: Commission earnings tracker.

Sections:
1. THIS MONTH summary: total earned, pending payment, paid
2. BREAKDOWN by type (bar chart or table)
3. HISTORY: list of all commission events, last 30
4. PAYMENT HISTORY: dates and amounts of past payments
5. "How commissions work" info link (shows commission rate table)

---

**A16: AshaOfflineQueue** 🔴 NEW SCREEN
Purpose: Show what is pending upload.

Shows:
- Total items pending: [N] photographs, [M] sessions, [P] registrations
- Per-patient breakdown
- "Upload now" button (active when connected)
- Last successful sync time
- Storage used on device for pending data
- Upload progress indicator when uploading

---

**A17: AshaReferralForm** 🔴 NEW SCREEN
Purpose: Generate PHC referral slip for high-risk patients.

Auto-filled from AI result and patient data:
- Patient name, age, village, phone
- Diagnosis code and description
- Risk finding from AI
- Recommended specialist
- Urgency level
- ASHA name and ID

"Generate referral slip" → creates formatted PDF (server-side)
"Share via WhatsApp" → shares PDF to ASHA's WhatsApp (can send to patient or PHC)
"Print" → sends to AirPrint compatible printer if available

---

### SHARED SCREENS

---

**S1: LanguageSelector** 🔴 NEW (inline toggle component used on multiple screens)
A toggle component: [English] [বাংলা]
On tap: update user preference (PUT /notifications/preferences), re-render all text.
All text from bengali.js constants file — never hardcoded inline.

**S2: HelpScreen** 🔴 NEW
FAQs in both languages. Phone: support contact. Email link.

**S3: AboutScreen** 🔴 NEW
IIT KGP logo, version number, legal disclaimer, privacy policy URL, credits.

**S4: NetworkStatus** 🔴 NEW (persistent component in app layout)
Small banner shown when offline: "Offline — data will upload when connected"
Shows offline queue count.

**S5: ForceUpdate** 🔴 NEW
Shown when app version < min_app_version from app_config.
"Please update the DiabetesCare AI app to continue." + link to Play Store.

---

## 7. BUILD PHASES — WORK IN THIS ORDER

### PHASE A: Foundation (DO FIRST — IEC critical path)
Complete all of Phase A before starting Phase B.

A1. Database migration
   - Write migration scripts to add all 26 tables to existing SQLite database
   - Keep all existing data and tables unchanged
   - Add missing columns to existing tables (patients, asha_workers, doctors)
   - Write seed data for subscription_tiers, app_config

A2. AES-256-GCM encryption (Task 5)
   - Install: react-native-crypto-module (or react-native-aes-crypto)
   - Encrypt all photographs before POST /sessions/:id/photographs
   - Key derivation: PBKDF2 from patient_id + device_id + app secret
   - Store encrypted on GCS, decrypt on authorized download only
   - Test: verified encryption before any patient data collection

A3. Offline queue manager (Task 6)
   - Install: @react-native-community/netinfo
   - Create: src/services/offlineQueue.js
   - Local SQLite table: offline_queue (as specified in schema)
   - Queue: photograph uploads, session submissions, registrations
   - Auto-upload when connectivity restored (background task)
   - Show pending count in NetworkStatus component (S4)

A4. Patient registration rework (P4, P5)
   - Add new fields to PatientRegistration (P4)
   - Build MedicalHistorySetup (P5) as new screen
   - Update POST /auth/register to accept new fields
   - Update POST /patients/me/medical-history endpoint
   - Update patients table migration

A5. Consent screen rework (P6)
   - Add consent versioning
   - Add digital signature pad (react-native-signature-canvas)
   - Update POST /patients/me/consent endpoint
   - Store consent version in database

A6. JWT refresh mechanism
   - Implement silent token refresh (intercept 401, refresh, retry)
   - Store refresh_token in SecureStorage (react-native-keychain)
   - Auto-logout if refresh fails

A7. Biometric authentication
   - Install: react-native-biometrics
   - Add fingerprint prompt to PatientLogin (P3) and AshaLogin (A1)
   - Fallback to password

### PHASE B: Core Wound Product (after Phase A complete)
B1. Quality Validation Engine (Task 7)
   - On-device: blur detection, lighting check, distance estimation
   - Build QualityValidationOverlay component (P13)
   - Build PhotoReviewScreen (P14)
   - Rework CameraScreen (P12) with overlays and angle selector

B2. Wound site infrastructure
   - Build WoundSiteSelector (P8) with SVG foot diagram
     (SVG foot asset: create programmatically with View/Path components
      — no external image files needed for the foot outline)
   - POST /patients/me/wound-sites endpoint
   - Build WoundMonitorHome (P9)
   - Build WoundSessionGuide (P10) and CoinPlacementGuide (P11)

B3. Session and schedule infrastructure
   - Build session_schedule generation logic (server-side cron or triggered on subscription)
   - GET /patients/me/schedule endpoint
   - Build PatientHome (P7) redesign showing schedule

B4. Wound AI stub + result screens
   - Build WoundResultScreen (P15) with stub AI data (real AI integrated later)
   - Build WoundHistoryScreen (P16) with trend chart (use react-native-chart-kit)
   - POST /sessions and POST /sessions/:id/photographs endpoints
   - POST /sessions/:id/submit endpoint (returns stub AI result initially)

B5. ASHA foundation
   - Build AshaPatientSearch (A7)
   - Rework AshaHome (A2)
   - Build AshaPatientList (A5)
   - Build AshaWoundSiteSetup (A11)
   - Build AshaTrainingHome (A13) and AshaTrainingModule (A14)
   - Enforce training completion gate (cannot access patients until all modules passed)

### PHASE C: Monitoring Infrastructure (after Phase B complete)
C1. Alert engine (server-side)
   - alert generation triggered after every AI result
   - escalation logic: cron job every 4 hours checks unacknowledged RED alerts
   - Alert endpoints
   - Push notification via FCM (firebase-admin in Flask)
   - SMS via Twilio

C2. Skin module
   - Build SkinMonitorHome (P17), SkinSessionGuide (P18), SkinResultScreen (P19)
   - Skin AI stub integration
   - Add skin sessions to session_schedule

C3. Contributing factor module
   - Build ContributingFactorHome (P20), PallorCaptureGuide (P21),
     RedEyeCapture (P22), ContributingFactorResult (P23)
   - Pallor and eye triage AI stub integration
   - Add contributing factor sessions to session_schedule

C4. Teleconsult flow
   - Rework ConsultRequest (P24) and QueueStatus (P25)
   - Build TeleconsultComplete (P26)
   - Build PrescriptionDetail (P30) rework
   - Teleconsult endpoints

C5. Notification system
   - Build NotificationSettings (P31)
   - POST /notifications/device-token
   - FCM push + Twilio SMS for all notification types
   - Session reminder cron: check session_schedule daily at 08:00

C6. ASHA commissions and offline
   - Build AshaCommissionDashboard (A15)
   - Build AshaOfflineQueue (A16)
   - Commission calculation on server: triggered by session submission
   - AshaEnrollMonitoring (A10)

### PHASE D: Commercial Launch (after Phase C complete)
D1. Subscription system
   - Build SubscriptionManager (P28)
   - Build PaymentScreen (P29) with Razorpay SDK
   - Subscription state machine (server-side)
   - Payment verification endpoint
   - Subscription access enforcement (gate modules by subscription status)

D2. Doctor web dashboard (separate React web project)
   - DoctorLogin (D1), DoctorDashboard (D2), SessionReview (D4)
   - PatientWoundDetail (D3), AlertManagement (D5)
   - TeleconsultScheduler (D6), PrescriptionWriter (D7)
   - Department dashboard (D9), ReportGenerator (D10)

D3. Production deployment
   - Google Cloud Run deployment
   - PostgreSQL migration from SQLite
   - GCS bucket creation and security rules
   - Environment variables and secrets management
   - CI/CD via GitHub Actions

D4. PDF generation
   - ProgressReport (P32)
   - AshaReferralForm (A17)
   - Server-side: use WeasyPrint or reportlab in Flask

D5. ABDM integration
   - ABHA ID creation and linking
   - Health record upload (FHIR format)
   - Sandbox testing first, production after approval

---

## 8. TECHNICAL CONSTRAINTS AND CODING RULES

### 8.1 Code Architecture

```
/HealthScreenApp/src/
  /screens/           -- all screen components
    /patient/         -- patient screens (P1-P33)
    /asha/            -- asha screens (A1-A17)
    /shared/          -- shared screens (S1-S5)
  /components/        -- reusable UI components
    /camera/          -- CameraScreen, QualityOverlay, PhotoReview
    /charts/          -- WoundTrendChart, SessionChart
    /forms/           -- FormInput, DatePicker, ToggleGroup
    /ui/              -- Button, Card, Badge, AlertBanner
  /services/          -- API service layer
    api.js            -- axios config, interceptors, token refresh
    authService.js
    patientService.js
    sessionService.js   -- NEW
    woundSiteService.js -- NEW
    scheduleService.js  -- NEW
    alertService.js     -- NEW
    subscriptionService.js -- NEW
    paymentService.js   -- NEW
    ashaService.js
    offlineQueue.js     -- NEW
    notificationService.js -- NEW
  /constants/
    bengali.js          -- ALL Bengali text strings
    colours.js          -- colour palette constants
    commissions.js      -- ASHA commission rate constants
    api.js              -- endpoint strings
  /hooks/
    useAuth.js
    useOfflineQueue.js  -- NEW
    useSessionSchedule.js -- NEW
  /utils/
    encryption.js       -- AES-256-GCM helpers
    photoCompression.js -- compress before upload
    coinDetection.js    -- client-side coin detection helper
    validation.js       -- form validation helpers
  /navigation/
    RootNavigator.js    -- existing, prop-based
  /assets/
    /images/
    /fonts/
```

### 8.2 Mandatory Coding Rules

1. NEVER hardcode Bengali text inline. ALL Bengali text must come from
   src/constants/bengali.js imported at the top of each file.
   All Bengali strings in bengali.js must use Unicode escape sequences:
   e.g., '\u0986\u09AE\u09BE\u09B0' not 'আমার'
   File must be saved with: open(path, 'w', encoding='utf-8') in Python

2. NEVER use navigator.navigate() — use prop-based navigation:
   function MyScreen({ onNavigateNext, onNavigateBack }) { ... }

3. NEVER make direct fetch/axios calls in screen components.
   All API calls go through the services layer.

4. NEVER store JWT token in AsyncStorage.
   Use react-native-keychain (SecureStorage) for tokens.

5. NEVER commit a photograph to GCS without AES-256-GCM encryption.
   Encrypt in encryption.js BEFORE the upload call.

6. ALWAYS compress photographs before upload.
   Use photoCompression.js. Target: 800KB-1200KB.
   Original resolution: preserve. Quality: 85%.

7. NEVER show full AI clinical details to ASHA workers.
   ASHA sees only: risk level (HIGH/MEDIUM/LOW) + recommended action.
   Full AI details (Wagner Grade, infection probability, tissue %) are for
   patients and doctors only.

8. ALWAYS add audit_log entry for sensitive operations:
   - Patient data read
   - Photograph uploaded or downloaded
   - Prescription viewed
   - Consent signed or withdrawn
   - Payment completed

9. NEVER use integer auto-increment IDs.
   Use UUID (uuid library) for all new records.

10. ALWAYS handle API errors gracefully. Never show raw error messages to users.
    Show: "Something went wrong. Please try again." in appropriate language.
    Log the actual error server-side.

11. ALL timestamps: ISO 8601 format, UTC timezone.
    Display in Indian Standard Time (UTC+5:30) to users.

12. ASHA geographic binding: EVERY query that fetches patients for an ASHA
    worker MUST include WHERE village IN (asha.villages_covered).
    This is enforced in the database layer, not the UI layer.

13. Minimum touch target: 48×48dp for all interactive elements.

14. Every form field must have: label, placeholder, validation message location.
    Validation: real-time (on change) for format validation.
    Server-side validation: shown as error after submission.

15. The disclaimer "AI-assisted screening only. Not a medical diagnosis."
    MUST appear on EVERY screen that shows an AI result.
    It must be visible without scrolling (place near the top of the result).

---

## 9. SECURITY REQUIREMENTS — NON-NEGOTIABLE

### 9.1 Photo Encryption
Every photograph must be encrypted with AES-256-GCM before it leaves the device.
The encryption key is derived using PBKDF2 from:
- patient_id (from JWT payload)
- device_id (from react-native-device-info)
- APP_ENCRYPTION_SECRET (from environment variables, never committed to git)

Implementation in src/utils/encryption.js:
```javascript
import CryptoJS from 'react-native-crypto-js'; // or react-native-aes-crypto
export const encryptPhoto = async (photoBase64, patientId, deviceId) => {
  const secret = `${patientId}:${deviceId}:${APP_ENCRYPTION_SECRET}`;
  const key = CryptoJS.PBKDF2(secret, SALT, { keySize: 256/32, iterations: 1000 });
  const iv = CryptoJS.lib.WordArray.random(128/8);
  const encrypted = CryptoJS.AES.encrypt(photoBase64, key, { iv, mode: CryptoJS.mode.GCM });
  return { encrypted: encrypted.toString(), iv: iv.toString(), tag: encrypted.tag.toString() };
};
```

### 9.2 Certificate Pinning
Implement SSL certificate pinning for API calls.
Use react-native-ssl-pinning library.
Pin the production API certificate hash.
In development: allow any certificate (configurable via ENV).

### 9.3 Root/Jailbreak Detection
Use react-native-device-info to check isRooted() on app launch.
If rooted: show warning screen, do not allow login or photograph capture.
Exception: allow debug builds on rooted devices during development.

### 9.4 Session Security
- JWT token stored in react-native-keychain (secure enclave)
- 24-hour token expiry
- Silent refresh: intercept 401 in api.js, refresh token, retry original call
- Auto-logout after 30 minutes of inactivity (background state)
- On logout: clear all tokens from keychain, clear AsyncStorage

### 9.5 Data Minimisation
- GPS coordinates for photographs: OPTIONAL, requires explicit permission
- Device ID: used only for encryption key derivation, not stored in patient record
- ASHA workers cannot access patients outside their geographic assignment
- Patients cannot see other patients' data (enforced at API level, not just UI)

### 9.6 Photograph Privacy
- Photos are never cached locally after successful upload (delete from device)
- Offline queue photos are stored in app's private storage (not gallery)
- No photographs are accessible via device gallery or file explorer

---

## 10. STYLE AND UX GUIDELINES

### 10.1 Colour Usage
- Primary (navy #1A3A5C): buttons, headings, active states
- Secondary (blue #2463AE): links, secondary buttons
- Success/GREEN (teal #0D6B55): healing alerts, success states
- Warning/AMBER (#E67E00): attention needed, medium risk
- Danger/RED (#7B1818): urgent alerts, high risk, errors
- Background (#F4F8FC): all screen backgrounds
- Card (#FFFFFF): all card surfaces
- Border (#D4D9E0): all dividers and input borders
- Text primary (#0F0F0F): all body text
- Text secondary (#5A5A5A): labels, captions, secondary info

Alert level colours for banners:
- GREEN banner: background #E8F3DC, text #234F09, border #27500A
- AMBER banner: background #FEF3E2, text #7A3B00, border #E67E00
- RED banner: background #FBE8E8, text #7B1818, border #C0392B

### 10.2 Alert Level Display
Every alert level (GREEN/AMBER/RED) must be shown as:
1. Coloured banner across the full width of the screen
2. Icon (✓ for GREEN, ⚠ for AMBER, ✕ for RED)
3. Plain language message in the user's language
4. Never use only colour — always include icon and text (accessibility)

### 10.3 Language Display
- All user-facing text: checked against bengali.js constants
- Buttons: short labels (max 20 characters in Bengali)
- Medical terms: Bengali term first, English in parentheses
  e.g., "ক্ষত (wound)"
- Numbers: standard Arabic numerals (not Bengali numerals) — more legible
  for numeric inputs and measurements

### 10.4 Photograph Guidance Screens
All photograph capture flows must include:
- Illustrated example (hand-drawn style PNG or SVG, not photographic)
  showing correct positioning and technique
- "Correct" example with green border
- "Incorrect" common mistake with red border
- Brief text instruction (max 2 sentences)

### 10.5 Loading and Error States
Every screen that loads data must show:
- Loading: ActivityIndicator (use platform default) with skeleton cards
- Error: "Something went wrong" card with retry button
- Empty state: illustration + explanation + action button

### 10.6 Offline Mode
When offline:
- NetworkStatus banner at top of every screen
- Form submissions: "Will be saved and submitted when you connect"
- Photo capture: still allowed, queued in offline_queue
- Reading historical data: show cached data from AsyncStorage with timestamp
- New AI results: not available offline, show last known result

---

## 11. ENVIRONMENT VARIABLES

All sensitive configuration must be in .env (never committed to git).
Add all of these to .env and .env.example (with dummy values):

```
# Backend
FLASK_SECRET_KEY=
DATABASE_URL=sqlite:///dev.db
JWT_SECRET_KEY=
APP_ENCRYPTION_SECRET=

# Google Cloud
GCP_PROJECT_ID=
GCS_BUCKET_NAME=
GCS_CREDENTIALS_JSON=

# Third party
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
FIREBASE_CREDENTIALS_JSON=
GEMINI_API_KEY=

# AI
AI_CONFIDENCE_THRESHOLD=0.65
MAX_PHOTO_SIZE_KB=1200

# App
MIN_APP_VERSION=1.0.0
ALERT_ESCALATION_HOURS=4
TRIAL_DAYS=3
GRACE_PERIOD_DAYS=7
```

---

## 12. TESTING REQUIREMENTS

### Backend
- All existing 33 tests must continue to pass
- New test required for each new endpoint
- Test coverage: authentication, authorization, data validation, business logic
- Run: PYTHONPATH=/Users/dipak/HealthScreeningApp/backend pytest tests/ -v

### Mobile
- Manual testing after each phase on Pixel 4 AVD (API 37)
- Test offline behaviour: toggle airplane mode after photograph capture
- Test Bengali text: check all text in P7, P15, A2, A9 in Bengali mode
- Test biometric: enrol fingerprint on emulator before testing
- Test payment: use Razorpay test keys and test card numbers

---

## 13. IMMEDIATE FIRST TASK

When you begin working, start with this exact sequence:

1. Read this entire document
2. Read the existing codebase structure:
   - List all files in /Users/dipak/HealthScreeningApp/HealthScreenApp/src/
   - Read /Users/dipak/HealthScreeningApp/backend/app.py
   - Read /Users/dipak/HealthScreeningApp/backend/models.py (or wherever models are defined)
3. Start Phase A, Task A1: Database migration
   Write migration scripts for all 26 tables.
   Create: /Users/dipak/HealthScreeningApp/backend/migrations/001_full_schema.py
   Do NOT drop any existing tables or data.
   Run the migration and confirm success.
4. Report: list of tables created, list of tables modified,
   list of tables unchanged. Confirm 33 existing tests still pass.

Then ask: "Phase A Task A1 complete. Ready for A2 (encryption). Proceed?"

---

## END OF CURSOR MASTER PROMPT
## Version 2.0 | DiabetesCare AI | IIT Kharagpur
## Clinical Purpose: Preventing diabetic amputations through
## integrated wound and contributing factor monitoring
