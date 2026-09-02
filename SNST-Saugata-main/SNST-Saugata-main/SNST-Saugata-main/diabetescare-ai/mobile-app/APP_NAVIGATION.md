# HealthScreen App — Full navigation layout

Source: **Apps.pdf** (Intern Work Plan) + implemented screens in `src/screens/`.

## Part I — Launch & auth

```
SplashScreen (P1)
  ├─ session + valid → role route
  │    ├─ patient + onboarding done → PatientHome (P7)
  │    ├─ patient + onboarding pending → MedicalHistorySetup / Consent
  │    ├─ asha + training done → AshaHome (A2)
  │    └─ asha + training pending → AshaTrainingHome (A13)
  └─ no session → RoleSelect (P2)
       ├─ Patient → Login (P3) → PatientRegistration (P4) [new]
       │              → MedicalHistorySetup (P5) → Consent (P6) → PatientHome (P7)
       └─ ASHA → Login (A1) → AshaTrainingHome (A13) or AshaHome (A2)
```

## Part II — Patient hub (P7)

| Area | Screens | Status |
|------|---------|--------|
| Wound monitoring | P28 → P29, P8 → P9 → P10 → P11 → P12+P13 → P14 → P15 → P16 | Wired (demo data + local dashboard) |
| Skin monitor | P17 → P18 → P12 → P19 | Wired (demo) |
| Contributing factors | P20 → P21/P22 → P23 | Wired (demo) |
| Profile | P27 (History, Rx, Progress, Medical) | Implemented |
| Teleconsult | P24 → P25 → P26, P30 | Implemented |
| Settings | P31 NotificationSettings, P33 DataPrivacy, S1 LanguageSelect | P31/P33/S1 present |

## Part III — ASHA hub (A2)

| Area | Screens | Status |
|------|---------|--------|
| Register patient | A7 search → A3 register → consent → A6 condition | A7 added; A3 = PatientRegistration `asha_new` |
| My patients | A5 list on AshaHome → screening / A10 enroll | AshaHome |
| Monitoring | A11 wound site → A12 → P10 → P12 → P14 → A9 → A17 | Wired (offline queue on POST /sessions) |
| Commissions | A15 | AshaCommissionDashboard |
| Training | A13 → modules | AshaTrainingHome |
| Offline | A16 | AshaOfflineQueue |

## Screen index

| ID | Route name | File |
|----|------------|------|
| P1 | SplashScreen | SplashScreen.tsx |
| P2 | RoleSelect | RoleSelectScreen.tsx |
| P3 | Login | LoginScreen.tsx (patient/asha) |
| P4 | PatientRegistration | PatientRegistrationScreen.tsx |
| P5 | MedicalHistorySetup | MedicalHistorySetupScreen.tsx |
| P6 | Consent | ConsentScreen.tsx |
| P7 | PatientHome | PatientHome.tsx |
| P8–P16 | Wound* | WoundSiteSelector … WoundHistoryScreen |
| P17–P19 | Skin* | SkinMonitorHome … SkinResultScreen |
| P20–P23 | CF* | ContributingFactorHome … ContributingFactorResult |
| P24–P26 | Teleconsult* | ConsultRequest … TeleconsultComplete |
| P27 | PatientProfile | PatientProfileScreen.tsx |
| P28–P29 | Subscription | SubscriptionManagerScreen, PaymentScreen |
| P30 | PrescriptionDetail | PrescriptionDetailScreen.tsx |
| P31 | NotificationSettings | NotificationSettingsScreen.tsx |
| P32 | ProgressReport | ProgressReportScreen.tsx |
| P33 | DataPrivacySettings | DataPrivacySettings.tsx |
| S1 | LanguageSelect | LanguageSelect.tsx |
| A1 | Login | LoginScreen.tsx |
| A2 | AshaHome | AshaHome.tsx |
| A7 | AshaPatientSearch | AshaPatientSearch.tsx |
| A10 | AshaEnrollMonitoring | AshaEnrollMonitoring.tsx |
| A11 | AshaWoundSiteSetup | AshaWoundSiteSetup.tsx |
| A12 | AshaMonitoringSession | AshaMonitoringSession.tsx |
| A9 | AshaScreeningResult | AshaScreeningResult.tsx |
| A17 | AshaReferralForm | AshaReferralForm.tsx |
| A13 | AshaTrainingHome | AshaTrainingHome.tsx |
| A15 | AshaCommissionDashboard | AshaCommissionDashboard.tsx |
| A16 | AshaOfflineQueue | AshaOfflineQueue.tsx |

Backend (dev): `backend/app.py` on `http://0.0.0.0:5001`.
