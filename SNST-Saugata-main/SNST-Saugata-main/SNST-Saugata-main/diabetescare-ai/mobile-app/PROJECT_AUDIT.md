# PROJECT_AUDIT.md

**Generated:** 2026-05-22  
**Workspace:** `/Users/dipak/HealthScreenApp` (React Native mobile app)  
**Primary API:** `/Users/dipak/HealthScreeningApp/backend` (Flask + SQLAlchemy, blueprints)  
**Dev/stub API:** `/Users/dipak/HealthScreenApp/backend/app.py` (monolithic Flask, SQLite)  
**Doctor web UI:** `/Users/dipak/HealthScreeningApp/doctor-dashboard` (Vite + React, separate from mobile)

This audit covers the diabetes wound-monitoring product as implemented in the repository today. The mobile app often points at port **5001**; which backend is running determines whether flows are full or stubbed.

---

## 1. MOBILE APP SCREENS

All screens live under `src/screens/` (45 `.tsx` files, **~9,006** lines total). No `.jsx` screen files.

| File | Lines | Key features | Navigation targets |
|------|------:|--------------|-------------------|
| `src/screens/SplashScreen.tsx` | 60 | Logo, spinner; `resolveInitialRoute()` | Dynamic `replace` → RoleSelect, PatientHome, MedicalHistorySetup, Consent, PatientRegistration, AshaHome, AshaTrainingHome |
| `src/screens/RoleSelectScreen.tsx` | 85 | Patient vs ASHA role picker | **Login** (×2) |
| `src/screens/LoginScreen.tsx` | 344 | Phone/password, biometrics, server JWT; demo ASHA prefill | **PatientRegistration**, **MedicalHistorySetup**, **PatientHome**, **AshaHome**, **AshaTrainingHome**, **RoleSelect** |
| `src/screens/PatientRegistrationScreen.tsx` | 731 | First-time / edit / ASHA-register patient; local + server sync | **RoleSelect**, **MedicalHistorySetup**, **PatientHome**, **AshaHome** |
| `src/screens/MedicalHistorySetupScreen.tsx` | 180 | Diabetes history form; `POST /patients/me/medical-history` | **Consent** (onboarding), `goBack` |
| `src/screens/ConsentScreen.tsx` | 242 | Signature pad, local onboarding flags, consent API queue | **PatientHome** (`reset`), `goBack` |
| `src/screens/PatientHome.tsx` | 690 | Dashboard: wounds, alerts, schedule, subscription gate, teleconsult | Many (see §4); **logoutToRoleSelect** |
| `src/screens/PatientProfileScreen.tsx` | 128 | Profile tabs: medical, Rx, progress, subscription | **MedicalHistorySetup**, **ProgressReport**, **SubscriptionManager** |
| `src/screens/LanguageSelect.tsx` | 108 | EN/BN for legacy screening | **ConditionSelector** |
| `src/screens/ConditionSelector.tsx` | 215 | Skin / eye / wound condition pick | **CameraScreen** |
| `src/screens/CameraScreen.tsx` | 566 | Camera, wound multi-angle, quality overlay, demo analysis | **PhotoReview**, **SkinResult**, **ResultScreen** |
| `src/screens/ResultScreen.tsx` | 308 | Generic screening risk result | **ConsultRequest**, **AshaReferralForm**, reset → **PatientHome** / **AshaHome** |
| `src/screens/WoundSiteSelector.tsx` | 128 | Foot zone picker (patient) | **WoundMonitorHome**, reset/logout utils |
| `src/screens/WoundMonitorHome.tsx` | 172 | Per–wound-site hub | **WoundSessionGuide**, **WoundHistory** |
| `src/screens/WoundSessionGuide.tsx` | 149 | Multi-angle wound capture flow | **CoinPlacementGuide**, **CameraScreen** |
| `src/screens/CoinPlacementGuide.tsx` | 77 | Coin scale instructions | (incoming from WoundSessionGuide) |
| `src/screens/PhotoReviewScreen.tsx` | 165 | Photo quality review before submit | **WoundResult**, **AshaScreeningResult**, reset utils |
| `src/screens/WoundResultScreen.tsx` | 154 | Wound AI result + teleconsult CTA | **ConsultRequest**, reset → **PatientHome** |
| `src/screens/WoundHistoryScreen.tsx` | 94 | Past sessions list | **WoundResult** |
| `src/screens/SkinMonitorHome.tsx` | 46 | Skin module entry (subscription-gated) | **SkinSessionGuide**, reset/logout |
| `src/screens/SkinSessionGuide.tsx` | 58 | Skin capture guide | **CameraScreen** |
| `src/screens/SkinResultScreen.tsx` | 38 | Skin result summary | reset → **PatientHome** |
| `src/screens/ContributingFactorHome.tsx` | 80 | Pallor / red-eye hub | **PallorCaptureGuide**, **RedEyeCapture** |
| `src/screens/PallorCaptureGuide.tsx` | 79 | Pallor branch | **RedEyeCapture**, **CameraScreen** |
| `src/screens/RedEyeCapture.tsx` | 62 | Red-eye capture | **CameraScreen**, **ContributingFactorResult** |
| `src/screens/ContributingFactorResult.tsx` | 33 | Contributing-factor result | reset → **PatientHome** |
| `src/screens/ConsultRequestScreen.tsx` | 323 | Teleconsult request form | **QueueStatus**, `goBack` |
| `src/screens/QueueStatusScreen.tsx` | 260 | Queue polling | **TeleconsultComplete** |
| `src/screens/TeleconsultCompleteScreen.tsx` | 202 | Post-call rating, Rx link | **PrescriptionDetail**, reset → **PatientHome** |
| `src/screens/PrescriptionDetailScreen.tsx` | 123 | Prescription detail | `goBack` |
| `src/screens/NotificationSettingsScreen.tsx` | 336 | Notification prefs, FCM token | `goBack` |
| `src/screens/SubscriptionManagerScreen.tsx` | 389 | Tiers, pause/cancel, upgrade | **PaymentScreen** |
| `src/screens/PaymentScreen.tsx` | 282 | Razorpay checkout + dev mock pay | reset → **PatientHome** |
| `src/screens/ProgressReportScreen.tsx` | 50 | Demo PDF report alert | `goBack` |
| `src/screens/DataPrivacySettings.tsx` | 51 | DPDP copy | `goBack` |
| `src/screens/AshaHome.tsx` | 406 | ASHA hub: search, monitoring, commissions, offline | **LanguageSelect**, **AshaCommissionDashboard**, **AshaOfflineQueue**, **AshaEnrollMonitoring**, **AshaPatientSearch**, **AshaMonitoringSession**, **AshaWoundSiteSetup**, **PatientRegistration**, logout |
| `src/screens/AshaTrainingHome.tsx` | 84 | Training checklist (local storage) | **AshaHome** |
| `src/screens/AshaPatientSearch.tsx` | 124 | Patient search | **LanguageSelect**, **PatientRegistration** |
| `src/screens/AshaWoundSiteSetup.tsx` | 99 | ASHA wound-site setup | reset → **AshaHome** |
| `src/screens/AshaMonitoringSession.tsx` | 191 | ASHA monitoring session start | **WoundSessionGuide**, **AshaWoundSiteSetup** |
| `src/screens/AshaScreeningResult.tsx` | 137 | ASHA risk-only result | **AshaReferralForm** |
| `src/screens/AshaReferralForm.tsx` | 314 | Referral form + PDF share | `goBack` |
| `src/screens/AshaCommissionDashboard.tsx` | 246 | Commission UI | `goBack` |
| `src/screens/AshaOfflineQueue.tsx` | 230 | Offline queue flush UI | `goBack` |
| `src/screens/AshaEnrollMonitoring.tsx` | 167 | Subscription tier demo for ASHA | `goBack` |

**Navigation helpers** (`src/navigation/navigationUtils.ts`): `resetToPatientHome`, `resetToAshaHome`, `logoutToRoleSelect` — used instead of raw `navigate` on many wound/skin/ASHA screens.

---

## 2. MOBILE APP SERVICES

| File | Exported functions | API endpoints called |
|------|-------------------|---------------------|
| `apiClient.ts` | `api` (axios), `persistAuthTokens`, `clearAuthTokens` | `POST /api/v1/auth/refresh` (401 interceptor) |
| `authService.ts` | `registerWithServer`, `loginWithServer`, `loginAshaWithServer`, `logoutServer` | `POST /api/v1/auth/register`, `/login`, `/asha/login` |
| `subscriptionService.ts` | `fetchSubscriptionTiers`, `fetchMySubscription`, `createSubscription`, `upgradeSubscription`, `pauseSubscription`, `cancelSubscription`, `statusLabel`, `isSubscribedStatus` | `GET/POST /api/v1/subscriptions/*` |
| `paymentService.ts` | `verifyPayment`, `fetchPaymentHistory`, `verifyMockPayment` | `POST /api/v1/payments/verify`, `GET /api/v1/payments/history` |
| `monitoringSessionService.ts` | `submitMonitoringSession` | `POST /api/v1/sessions` (+ offline queue); **client-side demo AI** if server omits AI |
| `woundSiteService.ts` | `zoneToPayload`, `createAshaPatientWoundSite` | `POST /api/v1/asha/patients/:id/wound-sites` |
| `patientRemoteSync.ts` | `trySyncAshaPatientToServer` | `POST /api/v1/asha/patients` |
| `ashaReferralService.ts` | `downloadReferralPdfToCache`, `shareReferralPdfFile` | `POST /api/v1/asha/referrals/pdf` (**not in dev Flask**) |
| `ashaCommissionService.ts` | `fetchAshaCommissions` | `GET /api/v1/asha/commissions` (stub on dev Flask) |
| `notificationService.ts` | `getMyNotifications`, `markNotificationRead`, `getNotificationPreferences`, `putNotificationPreferences`, `postDeviceFcmToken` | `/api/v1/notifications/*` |
| `teleconsultService.ts` | `createTeleconsult`, `listMyTeleconsults`, `getTeleconsult`, `rateTeleconsult`, `markTeleconsultReceived`, `cancelTeleconsult` | `/api/v1/teleconsults/*` |
| `offlineQueue.ts` | `enqueueRequest`, `listPending`, `flush` helpers, etc. | Replays stored paths (sessions, consent, medical-history, …) |
| `offlineSync.ts` | `startOfflineQueueFlush`, `flushOfflineQueueNow` | Replays queue via `api` |
| `photoCrypto.ts` | `derivePhotoKey`, `encryptPhotoBytes`, `decryptPhotoBytes` | None (local AES-GCM) |

**Local storage (not services):** `appStorage.ts`, `onboardingStorage.ts`, `patientDashboardStorage.ts`, `ashaTrainingStorage.ts`, `ashaWoundSitesStorage.ts`, etc.

---

## 3. MOBILE APP COMPONENTS

| File | Renders | Used by |
|------|---------|---------|
| `WoundSiteSelectorPanel.tsx` | Plantar/dorsal foot zone grid | `WoundSiteSelector.tsx`, `AshaWoundSiteSetup.tsx` |
| `woundSiteTypes.ts` | `WOUND_ZONES` constants + types | `WoundSiteSelector`, `AshaWoundSiteSetup`, `woundSiteService.ts` |
| `QualityValidationOverlay.tsx` | Camera quality banner / badge | `CameraScreen.tsx` |
| `NetworkStatus.tsx` | Offline banner + pending queue count | `PatientHome.tsx` |

---

## 4. MOBILE APP NAVIGATION

### Structure

- **Library:** `@react-navigation/native` + `createNativeStackNavigator`
- **Entry:** `App.tsx` → `RootNavigator.tsx` (`initialRouteName="SplashScreen"`)
- **Splash routing:** `src/navigation/resolveInitialRoute.ts` (no JWT in navigator; session from AsyncStorage)

### Role-based initial routes

| Role | Condition | First screen after splash |
|------|-----------|---------------------------|
| None | No session | **RoleSelect** |
| Patient | No profile | **PatientRegistration** `{flow: 'first_time'}` |
| Patient | Onboarding incomplete | **MedicalHistorySetup** → **Consent** |
| Patient | Onboarding complete | **PatientHome** |
| ASHA | Training incomplete | **AshaTrainingHome** |
| ASHA | Training complete | **AshaHome** |

### Screen access by role

| Role | Primary hubs | Restricted / N/A |
|------|--------------|------------------|
| **Patient** | PatientHome, wound/skin/contributing flows, subscription, teleconsult, profile | ASHA-only screens (AshaHome, AshaMonitoringSession, …) |
| **ASHA** | AshaHome, patient search, wound setup, monitoring, referral | Patient subscription/payment; full clinical AI on ASHA result (risk-only) |

### Guards and gating

| Mechanism | Location | Behavior |
|-----------|----------|----------|
| Splash route resolver | `resolveInitialRoute.ts` | Forces onboarding sequence |
| Session check | `PatientHome` `useFocusEffect` | Logs out if no patient session |
| Subscription gate | `PatientHome.requireSubscription()` | Blocks skin/contributing without active/trial sub (API + local) |
| ASHA training gate | `resolveInitialRoute` + `AshaTrainingHome` | Blocks AshaHome until modules passed (local) |
| JWT on API | `apiClient` + Keychain | Bearer token; refresh on 401 |
| Backend role | Flask `@require_auth`, `@require_asha`, `@require_doctor` | Enforced server-side (full API) |
| Module submit gate | Full API `POST /sessions/:id/submit` | **403** if subscription SUSPENDED/EXPIRED |

No React Navigation `beforeRemove` guards. No doctor screens in mobile (web-only per spec).

---

## 5. BACKEND ROUTES

**Source:** `HealthScreeningApp/backend/routes/__init__.py` — **89 endpoints** across 14 blueprints.  
**Response envelope:** `{ success, data?, error? }` via `utils/response_helper.py`.

### 5.1 Health (no prefix)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness + DB check |

### 5.2 Auth — `/api/v1/auth`

| Method | Path | Body (key fields) | Response |
|--------|------|-------------------|----------|
| POST | `/register` | `phone_number`, `password`, `full_name`, `date_of_birth`, `gender`, `village`, `role` (patient) | JWT + user |
| POST | `/patient/register` | `name`, `phone`, `age`, `gender`, `village`, … | JWT + patient + trial subscription |
| POST | `/patient/login` | `phone`, `password` | JWT + patient |
| POST | `/asha/login` | `worker_id`, `pin` | JWT + asha profile |
| POST | `/doctor/login` | `email`, `password` | JWT + doctor (`role: doctor`) |
| POST | `/admin/login` | `email`, `password` | JWT |
| POST | `/refresh` | Refresh token header | New access/refresh tokens |
| POST | `/asha/reset-pin` | `worker_id`, `new_pin` (admin) | OK |

### 5.3 Patients — `/api/v1/patients` (patient JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET/PUT | `/me` | Profile read/update |
| GET | `/me/screenings`, `/me/consultations`, `/me/prescriptions` | Lists |
| POST/GET | `/me/medical-history` | Versioned diabetes history |
| POST/GET | `/me/consent`, `/me/consents` | Consent capture/list |
| GET/POST | `/me/wound-sites` | Wound sites + schedule seed |
| GET | `/me/schedule` | Session schedule |
| GET | `/me/monitoring-sessions`, `/me/wound-history` | Sessions + chart data |
| GET/POST | `/me/alerts`, `/me/alerts/:id/acknowledge` | Alerts |
| GET | `/me/photos` | Screening thumbnails |

### 5.4 Alerts — `/api/v1/alerts`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| PUT | `/:alert_id/acknowledge` | `note?` | Patient acknowledge |

### 5.5 Sessions — `/api/v1/sessions` (patient)

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/` | `wound_site_id`, `session_type`, `track` | Create session |
| POST | `/:id/photographs` | `angle`, `gcs_url`, `quality_score` | Add photo metadata |
| POST | `/:id/submit` | — | Submit → stub AI, alerts, commission; **subscription gate** |

### 5.6 Notifications — `/api/v1/notifications`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/device-token` | FCM registration |
| GET | `/me` | Inbox |
| PUT | `/:id/read` | Mark read |
| GET/PUT | `/preferences` | Notification prefs |

### 5.7 Screenings — `/api/v1/screenings`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/` | `condition_type`, `risk_level`, `consent_timestamp`, `photos`, … | Legacy screening |
| GET | `/:id` | Get screening |

### 5.8 Consultations — `/api/v1/consultations`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/` | Create consultation |
| GET | `/:id/status`, `/my-queue`, `/pending` | Status/queues |
| PUT | `/:id/accept`, `/:id/cancel` | Doctor accept / patient cancel |
| POST | `/:id/prescription` | Doctor prescription |

### 5.9 ASHA — `/api/v1/asha` (asha_worker JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/me/dashboard`, `/me/screenings`, `/me/commissions` | Dashboard |
| GET | `/me/patients/search` | Search patients |
| POST | `/patients/:id/wound-sites` | ASHA creates wound site |
| GET | `/me/training` | Training status |
| POST | `/me/training/complete` | Complete module |
| GET | `/me/offline-queue`, `/me/enrollment-summary`, `/me/commission-dashboard` | C6 stubs/summary |

### 5.10 Doctors — `/api/v1/doctors` (doctor JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/me`, `/me/alerts`, `/me/patients`, `/me/teleconsults`, `/me/queue`, `/me/stats` | Dashboard |
| GET | `/patients/:id`, `/patients/:id/wound-detail` | Clinical detail + chart |
| PUT | `/alerts/:id/acknowledge` | Doctor ack alert |
| PUT | `/teleconsults/:id/schedule` | Schedule callback |
| POST | `/prescriptions` | Write Rx |
| GET | `/department/dashboard` | Hospital B2B KPIs |
| POST | `/me/availability` | Availability JSON |

### 5.11 Admin — `/api/v1/admin`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard`, `/patients`, `/asha-workers`, `/consultations` | Admin ops |
| POST/PUT | `/doctors`, `/doctors/:id/activate|deactivate` | Doctor CRUD |
| POST | `/jobs/escalate-red-alerts` | Escalation job |

### 5.12 Teleconsults — `/api/v1/teleconsults`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/` | `request_type`, concerns, `session_id`, `alert_id`, `preferred_callback_time` | Create request |
| GET | `/me`, `/:id` | List/detail |
| PUT | `/:id/rate` | Patient rating |
| POST | `/:id/mark-received`, `/:id/cancel` | Complete/cancel |

### 5.13 Subscriptions — `/api/v1/subscriptions`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/tiers` | Public tier catalog |
| GET | `/me` | Current subscription + access flag |
| POST | `/` | `tier_id` / `tier_name` → Razorpay order |
| POST | `/me/upgrade`, `/me/pause`, `/me/cancel` | Lifecycle |

### 5.14 Payments — `/api/v1/payments`

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/verify` | Razorpay ids + signature | Activate subscription |
| GET | `/history` | Transaction list |

### 5.15 Dev Flask (`HealthScreenApp/backend/app.py`)

Monolithic app on **:5001**, SQLite `dev.sqlite`. Implements auth, wound sites, sessions (simplified), medical-history/consent stubs, ASHA training, **stub** teleconsult/notification/commission endpoints. **Does not implement** `/api/v1/subscriptions`, `/api/v1/payments`, or `/api/v1/asha/referrals/pdf`.

---

## 6. BACKEND MODELS

**ORM:** SQLAlchemy 2.x (`HealthScreeningApp/backend/models/`).  
**26 model classes** (10 core + 16 in `phase_a_tables.py`).

### Core models

| Model | Table | Key columns | Relationships |
|-------|-------|-------------|---------------|
| `User` | `users` | `id`, `phone_number`, `hashed_password`, `role`, `fcm_token`, `preferred_language`, … | — |
| `Patient` | `patients` | `id`, `user_id`, `name`, `phone`, `age`, `gender`, `village`, `password_hash`, `consent_given_at`, `is_commercial_subscriber`, … | → screenings, consultations, prescriptions |
| `Doctor` | `doctors` | `id`, `email`, `password_hash`, `nmc_number`, `hospital_*`, `consultation_phone`, `availability`, … | → consultations, prescriptions |
| `AshaWorker` | `asha_workers` | `id`, `worker_id`, `pin_hash`, `villages_covered`, `training_*`, `commission_balance`, … | → screenings, commissions |
| `Admin` | `admins` | `id`, `email`, `password_hash`, `role`, `active` | — |
| `Screening` | `screenings` | `patient_id`, `asha_id`, `condition_type`, `risk_level`, `photo_data`, `consent_timestamp`, … | → patient, asha, consultation |
| `Consultation` | `consultations` | `screening_id`, `patient_id`, `doctor_id`, `mode`, `status`, `fee_amount`, … | → screening, patient, doctor, prescription |
| `Prescription` | `prescriptions` | `consultation_id`, `doctor_id`, `patient_id`, `diagnosis`, `medications`, … | → consultation, doctor, patient |
| `Commission` | `commissions` | `asha_id`, `screening_id`, `amount`, `commission_type` | → asha, screening |
| `Device` | `devices` | `device_id`, `owner_id`, `owner_type`, `fcm_token` | — |
| `AuditLog` | `audit_logs` | `user_id`, `action`, `resource_type`, `ip_address`, … | — |

### Phase A / monitoring models (`phase_a_tables.py`)

| Model | Table | Purpose |
|-------|-------|---------|
| `SubscriptionTier` | `subscription_tiers` | BASIC/STANDARD/PREMIUM pricing |
| `AppConfig` | `app_config` | Runtime config key/value |
| `PatientMedicalHistory` | `patient_medical_history` | Versioned history |
| `WoundSite` | `wound_sites` | Foot wound locations |
| `PatientConsent` | `consents` | Research consent records |
| `MonitoringSession` | `monitoring_sessions` | Wound/skin/CF sessions |
| `Photograph` | `photographs` | Session photos metadata |
| `AiResult` | `ai_results` | AI output per session |
| `Alert` | `alerts` | RED/AMBER/GREEN alerts |
| `AshaPatientAssignment` | `asha_patient_assignments` | ASHA↔patient |
| `AshaCommissionLedger` | `asha_commissions` | Commission ledger |
| `AshaTrainingModule` | `asha_training_modules` | Training completion |
| `DoctorPatientAssignment` | `doctor_patient_assignments` | Doctor panel |
| `TeleconsultRequest` | `teleconsult_requests` | Phone callback requests |
| `Subscription` | `subscriptions` | State machine (TRIAL, ACTIVE, …) |
| `PaymentTransaction` | `payment_transactions` | Razorpay txs |
| `SessionSchedule` | `session_schedule` | Due dates / reminders |
| `Notification` | `notifications` | Push/SMS log |
| `NotificationPreference` | `notification_preferences` | User prefs |
| `ResearchExport` | `research_exports` | Admin exports |

**Root service module:** `subscription_service.py` (state machine, not under `services/`).

---

## 7. BACKEND SERVICES AND UTILITIES

### 7.1 `subscription_service.py` (app root)

| Function | Purpose |
|----------|---------|
| `patient_has_module_access` | Gate monitoring if SUSPENDED/EXPIRED |
| `transition` | Subscription state machine events |
| `ensure_trial_subscription` | Auto trial on register |
| `create_or_prepare_subscription` | Razorpay order + txn |
| `apply_payment_success` / `apply_payment_failed` | Payment webhooks |
| `apply_pause` / `apply_cancel` | Lifecycle |

### 7.2 `utils/` (16 files)

| File | Functions (summary) |
|------|---------------------|
| `response_helper.py` | `success`, `error`, `paginated` |
| `jwt_helper.py` | `make_tokens`, `claims_user_type` |
| `validators.py` | Phone, age, gender, sanitise, JSON parse |
| `photo_handler.py` | Base64 photo compress/validate |
| `doctor_router.py` | Find doctor for consultation queue |
| `doctor_dashboard.py` | Doctor panel list + wound charts |
| `schedule_generator.py` | Seed `session_schedule` rows |
| `alert_engine.py` | Generate alerts after AI |
| `alert_actions.py` | Patient alert acknowledge |
| `alert_escalation.py` | RED alert escalation job |
| `notify_stub.py` | Bridge to notification dispatch |
| `notification_dispatch.py` | FCM/SMS notification creators |
| `push_sms.py` | Firebase + Twilio senders |
| `session_reminder_job.py` | Schedule reminder cron |
| `razorpay_client.py` | Orders + signature verify (mock mode) |

### 7.3 Middleware

| File | Purpose |
|------|---------|
| `middleware/auth_middleware.py` | `require_auth`, `require_asha`, `require_doctor`, `require_admin` |
| `middleware/rate_limiter.py` | Flask-Limiter on auth/screening |

---

## 8. TESTS

**Location:** `HealthScreeningApp/backend/tests/` (pytest). **54 test functions** across 9 files (+ `conftest.py` fixtures).

| File | Tests | Coverage |
|------|------:|----------|
| `test_auth.py` | 13 | Patient register/login, consent, medical history, API register |
| `test_consultations.py` | 9 | Consultation create, accept, prescription, queue |
| `test_screenings.py` | 8 | Screening validation, permissions |
| `test_phase_c.py` | 6 | Skin/contributing sessions, alerts, schedule |
| `test_subscriptions.py` | 4 | State machine, payment verify, submit blocked when SUSPENDED |
| `test_notifications.py` | 4 | Prefs, device token, dispatch |
| `test_asha.py` | 4 | ASHA dashboard, wound site, training |
| `test_phase_b.py` | 3 | Wound site, schedule, session submit flow |
| `test_teleconsults.py` | 3 | Create, cancel window, rate |

**Mobile:** `__tests__/App.test.tsx` only (smoke). No integration/E2E tests for RN screens.

---

## 9. WHAT IS WORKING END-TO-END

Legend: **COMPLETE** = mobile → full API → DB → read back with tests or consistent implementation. **PARTIAL** = UI + local and/or stub API. **NOT STARTED** = spec/UI only.

| Flow | Status | Notes |
|------|--------|-------|
| Patient registration and login | **PARTIAL** | Works local + `HealthScreeningApp` auth; full API has `patient/register` + trial. Dev Flask uses different auth shape (`/register`). |
| ASHA worker login and patient registration | **PARTIAL** | ASHA login on both backends; patient register via local + `POST /asha/patients` sync. Geographic binding on full API only. |
| Wound site creation | **PARTIAL** | Patient + ASHA POST wound-sites on full API; dev Flask SQLite. Schedule seed on full API. |
| Wound monitoring session (photo → AI → alert) | **PARTIAL** | Full API: create → photographs → submit with **stub AI** in `sessions.py`. Mobile uses `monitoringSessionService` demo AI fallback. GCS upload not wired in mobile. Subscription gate on submit (full API). |
| Skin assessment session | **PARTIAL** | Phase C routes + tests; mobile skin flow uses camera/demo paths. |
| Contributing factor session | **PARTIAL** | Phase C tests; mobile pallor/red-eye → camera. |
| Teleconsult request and scheduling | **PARTIAL** | Full API + tests; mobile UI complete. Doctor schedule endpoint exists. Dev Flask returns **stubs**. |
| Alert generation and notification | **PARTIAL** | `alert_engine` + dispatch on submit (full API). FCM/SMS dry-run unless Twilio/Firebase configured. |
| ASHA training modules | **PARTIAL** | API complete; mobile uses **local** checklist in `AshaTrainingHome` (not all API-driven). |
| ASHA commissions | **PARTIAL** | Ledger on full API; mobile shows local demo + stub commission endpoint on dev Flask. |
| Subscription + Razorpay | **PARTIAL** | Full API + tests on **HealthScreeningApp** only; mobile P28/P29 wired. Dev Flask **missing** routes. |
| Doctor web dashboard | **PARTIAL** | Separate Vite app + doctor routes; not integrated with mobile. |
| Legacy condition screening (skin/eye/wound) | **PARTIAL** | `screenings` API + mobile `CameraScreen` demo analysis. |
| Consent + onboarding | **PARTIAL** | Mobile ConsentScreen fixed for signature; API consent on full backend; local onboarding flags. |
| Offline queue | **PARTIAL** | SQLite/AsyncStorage queue + flush; replay on reconnect. |

---

## 10. WHAT IS NOT YET BUILT

| Item | Evidence |
|------|----------|
| Real AI inference (Gemini/ONNX) on session submit | `sessions.py` uses stub/heuristic AI, not `alert_engine` with real model |
| GCS photograph upload from mobile | `Photograph.gcs_url` optional; mobile queues metadata, not encrypted blob upload pipeline |
| `POST /api/v1/asha/referrals/pdf` | Called from `ashaReferralService.ts`; **no route** in HealthScreeningApp backend |
| Subscription/payment on dev Flask | Mobile expects `/subscriptions`, `/payments`; only on HealthScreeningApp |
| Bengali strings centralization | Spec requires `constants/bengali.js`; text mostly inline English |
| Biometric login production path | `react-native-biometrics` wired in LoginScreen; server auth optional |
| Certificate pinning | Spec §9.2; not in `apiClient` |
| SessionReview (D4), ReportGenerator (D10) doctor screens | Listed in CURSOR_MASTER_PROMPT only |
| ABDM / ABHA integration | Schema fields exist; no integration flow |
| Research export UI | Model + admin job only |
| Prop-based navigation refactor | Spec says no `navigate()` in screens; app uses React Navigation throughout |
| `ProgressReportScreen` | Demo alert only, no PDF generation |
| `AshaEnrollMonitoring` | Demo tiers, not full payment flow |
| Patient dashboard from API | `PatientHome` uses `patientDashboardStorage` local snapshot, not live `/patients/me` aggregate |
| ASHA geographic patient filter at DB | Assignment table exists; search may not enforce villages on all paths |
| Razorpay native checkout production keys | Mock/dev paths only unless env configured |

**No `TODO` / `FIXME` / `HACK` comments** found in application source (mobile or HealthScreeningApp backend).

---

## 11. ENVIRONMENT AND CONFIGURATION

### Runtime versions (observed)

| Component | Version |
|-----------|---------|
| Node (engines) | `>=18` (package.json); observed **v24.15.0** |
| React Native | **0.73.11** |
| React | **18.2.0** |
| TypeScript (mobile) | **5.0.4** |
| Python (observed) | **3.14.4** |
| Flask | **3.0.0** |
| SQLAlchemy | **2.0.49** |

### Key mobile dependencies (`package.json`)

`@react-navigation/*`, `axios`, `@react-native-async-storage/async-storage`, `react-native-keychain`, `react-native-razorpay`, `react-native-signature-canvas`, `react-native-sqlite-storage`, `@noble/hashes`, `@noble/ciphers`, `react-native-fs`, `@react-native-community/netinfo`.

### Key backend dependencies (`requirements.txt`)

`flask`, `flask-sqlalchemy`, `flask-jwt-extended`, `flask-cors`, `flask-limiter`, `bcrypt`, `pytest`, `razorpay`, `firebase-admin`, `twilio`, `Pillow`, `psycopg2-binary`.

### Environment variables (full API — `config.py`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLAlchemy URI |
| `JWT_SECRET_KEY` / `SECRET_KEY` | JWT signing |
| `JWT_ACCESS_TOKEN_EXPIRES`, `JWT_REFRESH_TOKEN_EXPIRES_DAYS` | Token TTL |
| `ALLOWED_ORIGINS` | CORS |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_MOCK` | Payments |
| `NOTIFICATIONS_DRY_RUN` | Skip real push/SMS |
| `FIREBASE_CREDENTIALS_JSON`, `GOOGLE_APPLICATION_CREDENTIALS` | FCM |
| `TWILIO_*` | SMS |
| `FLASK_ENV`, `LOG_LEVEL`, `PORT`, `FLASK_DEBUG` | Server |
| `MAX_CONTENT_LENGTH` | Upload limit |

### `.env` files

| Path | Exists |
|------|--------|
| `/Users/dipak/HealthScreenApp/.env` | **No** |
| `/Users/dipak/HealthScreeningApp/backend/.env` | **Yes** (local secrets) |
| `/Users/dipak/HealthScreeningApp/backend/.env.example` | **No** |

Mobile API base: `src/config/api.ts` resolves Metro host → `http://<host>:5001` in dev.

---

## 12. KNOWN ISSUES

### Architecture

- **Two backends** with different route coverage; running the wrong server breaks subscriptions, payments, referrals, or teleconsult depth.
- **Two repo folders** (`HealthScreenApp` vs `HealthScreeningApp`) confuse paths in docs and CI.

### Code quality / deprecation

- Widespread SQLAlchemy **`Model.query.get()`** (legacy 1.x style) in `auth_middleware`, routes, tests — works on 2.0 but deprecated; prefer `db.session.get(Model, id)`.
- Mobile **`@noble/hashes`** caused Hermes `ReferenceError` on Consent screen; replaced with `consentHash.ts` for fingerprinting.
- Signature pad **hid Save button** via CSS; fixed with explicit Confirm button.

### Stubs and demo behavior

- Session submit AI is **not production ML** on either backend variant for monitoring sessions.
- `monitoringSessionService.ts` injects **demo AI** when API response lacks risk fields.
- `CameraScreen` supports **mock analysis** path for demos.
- Dev Flask **teleconsult/notification** endpoints return empty or static payloads.
- `NOTIFICATIONS_DRY_RUN` defaults can silence real push/SMS in dev.

### Security / config hardening

- Default `JWT_SECRET_KEY=change-me` in config if unset.
- `PHOTO_KDF_SECRET` and Razorpay test keys in mobile/backend dev defaults.
- No `.env` in mobile repo; secrets only on developer machine.
- Audit middleware writes **audit log on every authenticated request** (can grow quickly).

### Missing production integrations

- Firebase/Twilio optional — notifications stored but may not deliver.
- Razorpay requires real keys + `RAZORPAY_MOCK=0` for production payments.
- Legacy SQLite dev DB may lack columns until migrations run (`upgrade_doctors_web`, `upgrade_teleconsult_requests_c4`, `upgrade_subscription_d1`).

### Testing gaps

- No automated mobile E2E tests against Flask.
- Doctor dashboard (`doctor-dashboard/`) has **no pytest** in repo.

### Git / build hygiene

- `android/app/build/` artifacts have appeared in git status in past sessions — should stay gitignored.
- Large Recharts bundle warning in doctor-dashboard build (>500 kB chunk).

---

## Related artifacts

| Artifact | Path |
|----------|------|
| Master spec | `CURSOR_MASTER_PROMPT.md` |
| App navigation map | `APP_NAVIGATION.md` |
| Doctor dashboard README | `../HealthScreeningApp/doctor-dashboard/README.md` |
| Backend dev README (subscriptions) | `backend/README.md` (HealthScreenApp) |

---

*End of audit.*
