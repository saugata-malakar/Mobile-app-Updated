# Google Play Store Deployment Guide — DiabetesCare AI (`com.iitkgp.diabetescareai`)

This guide walks you step-by-step from your signed Android App Bundle (`.aab`) to a live Google Play Store listing.

---

## Step 1: Verify Release Artifacts & Back Up Your Upload Keystore

Before doing anything in Play Console, back up your signing credentials in **two separate secure offline locations** (e.g., encrypted USB drive + institutional vault). **Never commit `diabetescare-release.keystore` or `keystore.properties` to GitHub.**

- **Signed App Bundle (for Google Play Store):**
  `mobile-app/android/app/build/outputs/bundle/release/app-release.aab`
- **Signed Release APK (for direct sideload testing):**
  `mobile-app/android/app/build/outputs/apk/release/app-release.apk` (also copied to `DiabetesCareAI.apk`)
- **Upload Keystore:**
  `mobile-app/android/app/diabetescare-release.keystore`
  - Keystore Type: `PKCS12` | Alias: `diabetescare_upload` | Validity: `10,000 days`
  - Signing Config: `mobile-app/android/keystore.properties` (already `.gitignore`d)
- **If you ever lose the keystore:** Google Play App Signing allows an upload key reset via Play Console support, but keeping a backup avoids deployment delays.

> **Important Pre-Production Check (Backend URL):**
> Ensure the mobile app connects to your **HTTPS** production FastAPI URL (e.g., Render deployment) rather than a local LAN IP (`http://192.168.x.x:8000`) when submitting to Google Play Production, so Google Play reviewers outside your local Wi-Fi can log in and test every role!

---

## Step 2: Host the Privacy Policy URL

Google Play requires a publicly accessible HTTPS Privacy Policy URL for all apps—especially Medical/Health apps.

1. A complete DPDP Act 2023 & Google Play compliant policy has been created at:
   `doctor-dashboard/public/privacy-policy.html`
2. Push your repository / deploy `doctor-dashboard` to Vercel.
3. Verify in an incognito browser that the live URL loads cleanly:
   `https://doctor-dashboard-mu.vercel.app/privacy-policy.html`

---

## Step 3: Create & Verify Your Google Play Developer Account

1. Go to [Google Play Console](https://play.google.com/console/signup).
2. Sign in with the official project/institutional Google account.
3. Choose **Account Type**:
   - **Organization Account (Recommended for IIT Kharagpur / MMCH):**
     - Requires a **D-U-N-S Number** (verify/look up IIT Kharagpur's D-U-N-S number), organization website, official email, and authorized representative ID.
     - **Advantage:** Organization accounts are **exempt** from the 20-tester 14-day closed testing requirement!
   - **Personal Account:**
     - Requires government ID + address verification.
     - **Note:** Personal accounts created after Nov 2023 must run a **Closed Test with at least 12–20 opted-in testers for 14 continuous days** before Production access is unlocked.
4. Pay the **$25 one-time registration fee** and wait for identity verification (typically 2–5 business days).

---

## Step 4: Create the App in Play Console

1. In Play Console, click **Create app**.
2. Enter:
   - **App name:** `DiabetesCare AI: Foot Triage` *(30-character Play Console limit)*
   - **Default language:** `English (United States) – en-US` or `English (India) – en-IN`
   - **App or game:** `App`
   - **Free or paid:** `Free`
3. Accept the Developer Program Policies and US export laws, then click **Create app**.

---

## Step 5: Complete Policy & App Content Declarations

In the left sidebar under **Policy -> App content**, complete every required section using `play_store_assets/PLAY_STORE_LISTING.md`:

1. **Privacy Policy:** Enter `https://doctor-dashboard-mu.vercel.app/privacy-policy.html`.
2. **App Access:** Select *"All or some functionality is restricted"* and paste the 4 reviewer test accounts (Doctor, ASHA/Field Worker, Moderator, Admin) + walkthrough steps from `PLAY_STORE_LISTING.md` Section 4.
3. **Ads:** Select *"No, my app does not contain ads"*.
4. **Content Rating:** Complete the IARC questionnaire (`Medical` / clinical tool, no violence/NSFW/UGC) and apply the rating.
5. **Target Audience & Content:** Select `18 and over`. Confirm the store listing does not appeal to children.
6. **News Apps / COVID-19:** Select `No`.
7. **Data Safety:** Fill in the exact Data Safety answers from `PLAY_STORE_LISTING.md` Section 3 (encrypted in transit, account/data deletion link, Personal Info + Health Info + Photos collected for App Functionality only, not shared).
8. **Health Apps Declaration (CRITICAL):**
   - Because DiabetesCare AI screens diabetic foot conditions and collects patient health data, Play Console requires the **Health Apps Declaration**.
   - Select **Clinical Decision Support** and **Disease Management / Healthcare Services & Telehealth**.
   - Declare clearly that the app is an institutional screening and clinical triage support tool used by authorized clinicians/health workers and does not replace professional medical diagnosis.
9. **Government Apps:** Select `No` (unless formally published on behalf of a state health department with authorization letter; otherwise keep `No` to avoid government authorization letter rejection—note that ASHA workers use it as an academic/hospital clinical triage tool).

---

## Step 6: Set Up Store Listing & Visual Assets

Under **Grow -> Store presence -> Main store listing**:

1. **App Name, Short Description, Full Description:** Copy from `play_store_assets/PLAY_STORE_LISTING.md`.
2. **App Icon (512×512):** Upload `play_store_assets/app_icon_512x512.png`.
3. **Feature Graphic (1024×500):** Upload `play_store_assets/feature_graphic_1024x500.png`.
4. **Phone Screenshots (1080×1920):** Upload all 5 screenshots from `play_store_assets/screenshots/`:
   - `screen_login.png`
   - `screen_3photo_lock.png`
   - `screen_ai_review_real.png`
   - `screen_doctor_diagnosis.png`
   - `screen_doctor_hub.png`
5. Under **Store settings**, set **App category** to `Medical`, add contact email (`privacy@diabetescare-ai.iitkgp.ac.in`), and save.

---

## Step 7: Enroll in Play App Signing & Upload `app-release.aab`

1. Navigate to **Release -> Testing -> Internal testing** (recommended first!) or **Production**.
2. Click **Create new release**.
3. Under **App integrity / Play App Signing**, click **Continue** to let Google manage the App Signing Key (your local `diabetescare-release.keystore` acts as your **Upload Key**).
4. Upload:
   `mobile-app/android/app/build/outputs/bundle/release/app-release.aab`
5. Add Release Name (`4.0.0 (4)`) and Release Notes:
   ```text
   DiabetesCare AI v4.0.0:
   - Unified 4-role clinical workflow (Doctor, ASHA/ICDS/CHO, Moderator, Admin)
   - Standardized 3-photo calibration capture & automated image quality check
   - Follow-up tracking, clinical notes, and DPDP Act 2023 compliance
   ```
6. Click **Next -> Save**, fix any pre-launch warnings if shown, and roll out to **Internal Testing** first to verify installation from Play Store on a physical Android phone.

---

## Step 8: Submit to Production & Review

1. Once Internal Testing (and Closed Testing if using a personal developer account) is verified:
   - Promote the tested release from Testing to **Production** (or create a Production release with the same `.aab`).
   - Select Target Countries/Regions (e.g., **India** — or All countries if desired for reviewers).
2. Go to **Publishing overview** and send changes for **Google Play Review**.
3. **Typical Review Time:**
   - First-time **Medical / Health** apps usually take **3–7 business days** (Google verifies App Access credentials, Privacy Policy URL, Data Safety consistency, and Health Apps Declaration).
4. Keep your backend server and reviewer test accounts online continuously during the review window!
