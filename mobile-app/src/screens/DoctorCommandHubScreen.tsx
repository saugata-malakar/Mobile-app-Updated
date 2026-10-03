// mobile-app/src/screens/DoctorCommandHubScreen.tsx
// Complete simulation of doctor-dashboard-mu.vercel.app with all 5 options inspected from live DOM

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { UserPersona } from './PortalLoginScreen';

const NAVY_BG   = '#0B132B';
const SIDEBAR_BG= '#0E1736';
const CARD_BG   = '#111C38';
const SUB_CARD  = '#0C152E';
const BORDER    = '#23355E';
const BORDER_LIGHT = '#1E2E56';
const BLUE_BTN  = '#2563EB';
const EMERALD   = '#10B981';
const AMBER     = '#F59E0B';
const RED       = '#EF4444';
const INDIGO    = '#6366F1';
const TEXT_MUTED = '#94A3B8';

interface PatientRecord {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  village: string;
  district: string;
  wagner_grade: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  latest_wound_area_cm2: number;
  registered_by: string;
  registered_at: string;
}

const COHORT_PATIENTS: PatientRecord[] = [
  {
    patient_id: 'PAT_KGP_01',
    name: 'Ramesh Chandra Sen',
    age: 58,
    gender: 'Male',
    phone: '+91 98310 12345',
    village: 'Kharagpur Rural',
    district: 'Paschim Medinipur',
    wagner_grade: 2,
    urgency: 'HIGH',
    latest_wound_area_cm2: 2.57,
    registered_by: 'ASHA_WB_0042',
    registered_at: '2026-08-10T09:30:00Z',
  },
  {
    patient_id: 'PAT_KGP_02',
    name: 'Anjali Devi Das',
    age: 62,
    gender: 'Female',
    phone: '+91 94340 54321',
    village: 'Binpur Block II',
    district: 'Jhargram',
    wagner_grade: 2,
    urgency: 'HIGH',
    latest_wound_area_cm2: 2.90,
    registered_by: 'ASHA_WB_0043',
    registered_at: '2026-08-14T11:15:00Z',
  },
  {
    patient_id: 'PAT_KGP_03',
    name: 'Sunil Kumar Roy',
    age: 50,
    gender: 'Male',
    phone: '+91 98312 34567',
    village: 'Tamluk Sub-division',
    district: 'Purba Medinipur',
    wagner_grade: 1,
    urgency: 'MEDIUM',
    latest_wound_area_cm2: 1.45,
    registered_by: 'ASHA_WB_0044',
    registered_at: '2026-08-18T14:20:00Z',
  },
  {
    patient_id: 'PAT_KGP_04',
    name: 'Lakshmi Narayan Paul',
    age: 67,
    gender: 'Male',
    phone: '+91 97355 67890',
    village: 'Khatra Block I',
    district: 'Bankura',
    wagner_grade: 3,
    urgency: 'HIGH',
    latest_wound_area_cm2: 7.10,
    registered_by: 'ASHA_WB_0045',
    registered_at: '2026-08-22T10:00:00Z',
  },
];

const TRAJECTORY_DATA = [
  { date: '10 Aug', area: 5.2 },
  { date: '14 Aug', area: 4.6 },
  { date: '18 Aug', area: 3.9 },
  { date: '22 Aug', area: 3.4 },
  { date: '26 Aug', area: 2.8 },
  { date: '30 Aug', area: 2.3 },
  { date: '02 Sep', area: 1.8 },
];

export default function DoctorCommandHubScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const currentRole: 'doctor' | 'patient' | 'asha' | 'hospital_admin' =
    route.params?.userRole || 'patient';
  const profile: UserPersona = route.params?.userProfile || {
    role: 'patient',
    name: 'Ramesh Chandra Sen',
    title: 'Enrolled Cohort Patient',
    badge: 'Patient Portal',
    badgeColor: EMERALD,
    description: 'My Healing Journey, personal ulcer trajectory, medication guide & Govt eSanjeevani teleconsult.',
    icon: '🩹',
    mrnOrId: 'MRN: PAT_KGP_01',
    facility: 'Kharagpur Rural · Paschim Medinipur',
  };

  // ── 5 Primary Options Navigation State ──
  // 1: 'healing_journey' (My Healing Journey)
  // 2: 'teleconsult' (Join Govt Teleconsult)
  // 3: 'camera_flow' (Mobile Camera Capture Flow)
  // 4: 'trajectory' (Full Wound Trajectory)
  // 5: 'care_preferences' (My Care Preferences)
  // Plus 'triage' (Clinical Triage Command)
  const [activeTab, setActiveTab] = useState<string>(
    currentRole === 'doctor' ? 'triage' : 'healing_journey'
  );

  // ── Search & Filter State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedWagner, setSelectedWagner] = useState<string>('ALL');

  // ── Doctor Override State ──
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [overridePatient, setOverridePatient] = useState<PatientRecord | null>(null);
  const [overrideLength, setOverrideLength] = useState('24.1');
  const [overrideWidth, setOverrideWidth] = useState('13.8');
  const [overrideArea, setOverrideArea] = useState('2.57');
  const [overrideNotes, setOverrideNotes] = useState('');

  // ── Teleconsult Call Simulator State ──
  const [inCall, setInCall] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [callNotes, setCallNotes] = useState('');

  // ── Option 4 View Toggle (Segmentation vs Original) ──
  const [showSegmentationOverlay, setShowSegmentationOverlay] = useState(true);

  // ── Option 5 Care Preferences / Settings State ──
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(true);
  const [emailDigestsEnabled, setEmailDigestsEnabled] = useState(true);
  const [autoEscalateEnabled, setAutoEscalateEnabled] = useState(true);
  const [selectedLang, setSelectedLang] = useState('English');

  // ── Live Cohort & Alerts State (Reflects Submitted Captures) ──
  const [cohortPatients, setCohortPatients] = useState<PatientRecord[]>(COHORT_PATIENTS);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadLiveCohort = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('http://192.168.31.94:8000/api/v1/patients');
      if (res.ok) {
        const json = await res.json();
        const serverPatients: any[] = json?.data?.patients || json?.data?.items || [];
        if (serverPatients.length > 0) {
          const mapped: PatientRecord[] = serverPatients.map((sp: any) => ({
            patient_id: sp.patient_id || sp.id,
            name: sp.full_name || sp.name || sp.patient_id,
            age: sp.age || 55,
            gender: sp.gender ? (sp.gender.charAt(0).toUpperCase() + sp.gender.slice(1)) : 'Male',
            phone: sp.phone || '+91 98000 00000',
            village: sp.village || sp.district || 'Rural Sub-Centre',
            district: sp.district || 'Paschim Medinipur',
            wagner_grade: sp.wagner_grade ?? 1,
            urgency: (sp.urgency || (sp.wagner_grade >= 2 ? 'HIGH' : (sp.wagner_grade === 1 ? 'MEDIUM' : 'LOW'))) as any,
            latest_wound_area_cm2: typeof sp.latest_wound_area_cm2 === 'number' ? sp.latest_wound_area_cm2 : (sp.wagner_grade >= 2 ? 3.12 : 1.45),
            registered_by: sp.registered_by || 'ASHA_WB_0042',
            registered_at: sp.created_at || sp.registered_at || new Date().toISOString(),
          }));

          const combined = [...mapped];
          COHORT_PATIENTS.forEach(cp => {
            if (!combined.some(p => p.patient_id === cp.patient_id)) {
              combined.push(cp);
            }
          });
          setCohortPatients(combined);
        }
      }
    } catch (_e) {
      // offline fallback: preserve existing cohort
    }

    try {
      const aRes = await fetch('http://192.168.31.94:8000/api/v1/alerts');
      if (aRes.ok) {
        const aJson = await aRes.json();
        const alerts = aJson?.data?.items || aJson?.data?.alerts || [];
        if (alerts.length > 0) {
          setLiveAlerts(alerts);
        }
      }
    } catch (_e) {
      // offline fallback
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLiveCohort();
    }, [loadLiveCohort])
  );

  // ── Filtered Patients ──
  const filteredPatients = useMemo(() => {
    return cohortPatients.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.patient_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUrgency =
        selectedUrgency === 'ALL' || p.urgency === selectedUrgency;
      const matchesWagner =
        selectedWagner === 'ALL' || String(p.wagner_grade) === selectedWagner;
      return matchesSearch && matchesUrgency && matchesWagner;
    });
  }, [cohortPatients, searchQuery, selectedUrgency, selectedWagner]);

  const activePatient = cohortPatients.find(p => p.patient_id === 'PAT_KGP_01') || cohortPatients[0] || COHORT_PATIENTS[0];

  const launchCamera = (targetPatientId?: string) => {
    navigation.navigate('PhotoFlow', {
      patientId: targetPatientId || 'PAT_KGP_01',
      visitId: `VIS_${Date.now().toString(36).toUpperCase()}`,
      operatorId: profile.mrnOrId,
    });
  };

  const openOverride = (patient: PatientRecord) => {
    setOverridePatient(patient);
    setOverrideArea(String(patient.latest_wound_area_cm2));
    setOverrideModalVisible(true);
  };

  const saveOverride = () => {
    Alert.alert(
      'Authoritative Override Saved',
      `Dr. Clinical Specialist recorded verified measurements: Area ${overrideArea} cm², Length ${overrideLength} mm, Width ${overrideWidth} mm for ${overridePatient?.name}.`,
      [{ text: 'OK', onPress: () => setOverrideModalVisible(false) }]
    );
  };

  // ── The 5 Primary Options + Command Hub ──
  const navTabs = [
    { id: 'healing_journey', label: '1. My Healing Journey', icon: '🩹' },
    { id: 'teleconsult', label: '2. Join Govt Teleconsult', icon: '📹' },
    { id: 'camera_flow', label: '3. Mobile Camera Flow', icon: '📱' },
    { id: 'trajectory', label: '4. Full Wound Trajectory', icon: '📈' },
    { id: 'care_preferences', label: '5. My Care Preferences', icon: '⚙️' },
    { id: 'triage', label: 'Clinical Triage Command', icon: '⚡' },
    { id: 'informatics', label: 'AI Informatics & KPIs', icon: '📊' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY_BG} />

      {/* ── Top Website Header Bar ── */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <TouchableOpacity
            style={styles.roleTag}
            onPress={() => navigation.navigate('PortalLogin')}>
            <Text style={styles.roleTagText}>Ramesh Chandra Sen</Text>
          </TouchableOpacity>
          <Text style={styles.topFacilityText}>| Midnapore Apex Hub · Node #01</Text>
        </View>

        <View style={styles.topHeaderRight}>
          <TouchableOpacity
            style={styles.mobileSimBtn}
            onPress={() => launchCamera()}>
            <Text style={styles.mobileSimBtnText}>📱 Launch Simulator</Text>
          </TouchableOpacity>
          <View style={styles.fastApiBadge}>
            <View style={styles.greenPulse} />
            <Text style={styles.fastApiText}>FastAPI Port 8000</Text>
          </View>
        </View>
      </View>

      {/* ── Horizontal Navigation Tabs (The 5 Options) ── */}
      <View style={styles.navBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navBarScroll}>
          {navTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.navTab, isActive && styles.navTabActive]}
                onPress={() => {
                  if (tab.id === 'camera_flow') {
                    setActiveTab('camera_flow');
                  } else {
                    setActiveTab(tab.id);
                  }
                }}>
                <Text style={styles.navTabIcon}>{tab.icon}</Text>
                <Text style={[styles.navTabLabel, isActive && styles.navTabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Main View Content Area ── */}
      <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>

        {/* ═══════════════════════════════════════════════════════════════════
            OPTION 1: "My Healing Journey" (/patient-portal)
            (Inspected from live DOM: Welcome, SOS 112/108, Overall 68%,
             Next dressing change, Doctor's Care Advice, Digital Prescriptions)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'healing_journey' && (
          <View style={styles.viewContainer}>
            <View style={styles.commandBanner}>
              <View style={styles.deptBadgeRow}>
                <Text style={styles.deptLabel}>WELCOME, RAMESH CHANDRA SEN</Text>
                <View style={styles.hubBadge}>
                  <Text style={styles.hubBadgeText}>MRN: PAT_KGP_01</Text>
                </View>
              </View>
              <Text style={styles.commandTitle}>My Wound Healing Journey</Text>
              <Text style={styles.commandSubtitle}>
                Left Plantar Great Toe Ulcer · Assigned Doctor: Dr. Clinical Specialist (Diabetology & Vascular Wound Care)
              </Text>
              <TouchableOpacity
                style={[styles.bannerTeleBtn, { marginTop: 6, alignSelf: 'flex-start' }]}
                onPress={() => setActiveTab('teleconsult')}>
                <Text style={styles.bannerTeleBtnText}>📹 Join Doctor Teleconsult</Text>
              </TouchableOpacity>
            </View>

            {/* Emergency SOS Banner */}
            <View style={styles.sosCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosTitle}>🚨 Experiencing severe pain, spreading redness, or high fever?</Text>
                <Text style={styles.sosSubtitle}>Call 24x7 National Medical Emergency or Diabetic Foot Helpline immediately.</Text>
              </View>
              <TouchableOpacity
                style={styles.sosBtn}
                onPress={() => Alert.alert('Emergency Assistance', 'Connecting to 112 / 108 Emergency Medical Services.')}>
                <Text style={styles.sosBtnText}>CALL 112 / 108 SOS</Text>
              </TouchableOpacity>
            </View>

            {/* Overall Healing Progress Card */}
            <View style={styles.card}>
              <Text style={styles.statLabel}>OVERALL HEALING PROGRESS</Text>
              <View style={styles.progressRow}>
                <Text style={[styles.statVal, { color: EMERALD, fontSize: 32 }]}>
                  {Math.min(100, Math.max(0, Math.round(((5.20 - (activePatient.latest_wound_area_cm2 || 2.57)) / 5.20) * 100)))}%
                </Text>
                <Text style={styles.progressSubText}>
                  Area reduced from 5.20 cm² to {(activePatient.latest_wound_area_cm2 || 2.57).toFixed(2)} cm²
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, Math.round(((5.20 - (activePatient.latest_wound_area_cm2 || 2.57)) / 5.20) * 100)))}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Next Dressing Change Card */}
            <View style={styles.card}>
              <Text style={styles.statLabel}>NEXT DRESSING CHANGE</Text>
              <Text style={styles.cardHeaderTitle}>Tomorrow, 10:00 AM</Text>
              <Text style={styles.guideItem}>• ASHA Health Worker: Manasi Roy (+91 97321 55432)</Text>
              <Text style={styles.guideItem}>• Protocol: Sterile Saline Irrigation + Hydrocolloid Foam Barrier</Text>
            </View>

            {/* Doctor's Care Advice */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>👨‍⚕️ Doctor's Care Advice</Text>
              <Text style={styles.guideItem}>• Avoid walking barefoot at all times.</Text>
              <Text style={styles.guideItem}>• Take Amoxicillin-Clavulanate 625mg twice daily after meals.</Text>
              <Text style={styles.guideItem}>• Maintain morning fasting blood sugar below 130 mg/dL.</Text>
            </View>

            {/* Active Digital Prescriptions */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>💊 ACTIVE DIGITAL PRESCRIPTIONS</Text>
              <View style={styles.prescriptionBox}>
                <Text style={styles.prescripDrug}>Amoxicillin-Clavulanate (Augmentin)</Text>
                <Text style={styles.prescripDosage}>625 mg · 1 Tablet Twice Daily (BID) · 7 Days</Text>
                <Text style={styles.prescripInst}>Take after food. Complete full antibacterial course.</Text>
              </View>
              <View style={styles.prescriptionBox}>
                <Text style={styles.prescripDrug}>Hydrocolloid Barrier Foam Dressing</Text>
                <Text style={styles.prescripDosage}>Topical Application · Change every 48 hours</Text>
                <Text style={styles.prescripInst}>Irrigate wound with sterile normal saline before application.</Text>
              </View>
            </View>

            {/* Capture Today's Progress Button */}
            <TouchableOpacity
              style={styles.bigCaptureBtn}
              onPress={() => launchCamera('PAT_KGP_01')}>
              <Text style={styles.bigCaptureBtnText}>📸 Capture Today's Progress Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            OPTION 2: "Join Govt Teleconsult" (/teleconsults)
            (Inspected from live DOM: Live Patient Consultation, Ready banner,
             Queue of 2, Launch Live Video Session, Scheduled slots)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'teleconsult' && (
          <View style={styles.viewContainer}>
            <View style={styles.commandBanner}>
              <View style={styles.deptBadgeRow}>
                <Text style={styles.deptLabel}>eSANJEEVANI & ABDM TELEHEALTH</Text>
                <View style={styles.hubBadge}>
                  <Text style={styles.hubBadgeText}>Verified Govt Network</Text>
                </View>
              </View>
              <Text style={styles.commandTitle}>🏛️ National Teleconsultation Network</Text>
              <Text style={styles.commandSubtitle}>
                Encrypted WebRTC telehealth conduit between Midnapore Apex Hub and Rural Sub-Centres.
              </Text>
            </View>

            {inCall ? (
              <View style={styles.videoRoomCard}>
                <View style={styles.remoteVideoArea}>
                  <Text style={styles.remoteVideoUser}>👨‍⚕️ Dr. Clinical Specialist (Lead Diabetologist)</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.greenPulse} />
                    <Text style={styles.liveBadgeText}>LIVE CONSULTATION · 04:18</Text>
                  </View>
                  <View style={styles.selfVideoArea}>
                    <Text style={styles.selfVideoText}>
                      {videoDisabled ? '📷 Camera Off' : '👤 Ramesh Chandra Sen'}
                    </Text>
                  </View>
                </View>

                {/* Call Controls */}
                <View style={styles.callControlsRow}>
                  <TouchableOpacity
                    style={[styles.callControlBtn, micMuted && styles.callControlBtnActive]}
                    onPress={() => setMicMuted(!micMuted)}>
                    <Text style={styles.callControlIcon}>{micMuted ? '🔇' : '🎙️'}</Text>
                    <Text style={styles.callControlLabel}>{micMuted ? 'Muted' : 'Mute'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callControlBtn, videoDisabled && styles.callControlBtnActive]}
                    onPress={() => setVideoDisabled(!videoDisabled)}>
                    <Text style={styles.callControlIcon}>{videoDisabled ? '🚫' : '📹'}</Text>
                    <Text style={styles.callControlLabel}>{videoDisabled ? 'Video Off' : 'Video'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callControlBtn, { backgroundColor: RED }]}
                    onPress={() => {
                      setInCall(false);
                      Alert.alert('Teleconsultation Concluded', 'Clinical consultation report logged to ABDM eSanjeevani.');
                    }}>
                    <Text style={styles.callControlIcon}>📞</Text>
                    <Text style={styles.callControlLabel}>End Call</Text>
                  </TouchableOpacity>
                </View>

                {/* Live Notes Pad */}
                <View style={styles.callNotesSection}>
                  <Text style={styles.cardHeaderTitle}>📝 Real-Time Clinical Consultation Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    multiline
                    numberOfLines={3}
                    placeholder="Enter physician observations, dressing revisions, or antibiotic prescriptions..."
                    placeholderTextColor="#64748B"
                    value={callNotes}
                    onChangeText={setCallNotes}
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {/* Ready Banner */}
                <View style={[styles.card, { borderColor: EMERALD }]}>
                  <Text style={[styles.cardHeaderTitle, { color: '#6EE7B7' }]}>✅ Teleconsultation Ready</Text>
                  <Text style={styles.guideItem}>Live Patient Consultation: Ramesh Chandra Sen (MRN: PAT_KGP_01)</Text>
                  <TouchableOpacity
                    style={[styles.bigCaptureBtn, { backgroundColor: EMERALD, marginTop: 8 }]}
                    onPress={() => setInCall(true)}>
                    <Text style={styles.bigCaptureBtnText}>📹 Launch Live Video Session</Text>
                  </TouchableOpacity>
                </View>

                {/* Teleconsultation Queue (2) */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderTitle}>Teleconsultation Queue (2 Pending)</Text>

                  <View style={styles.queueItem}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.queuePatient}>Ramesh Chandra Sen (Scheduled)</Text>
                      <Text style={styles.patDetails}>MRN: PAT_KGP_01 · Urgent Wound Review</Text>
                      <Text style={styles.alertDesc}>Increasing pain and mild yellowish drainage at plantar great toe.</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.connectCallBtn}
                      onPress={() => setInCall(true)}>
                      <Text style={styles.connectCallBtnText}>Connect</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.queueItem}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.queuePatient}>Lakshmi Narayan Paul (Scheduled)</Text>
                      <Text style={styles.patDetails}>MRN: PAT_KGP_04 · Deep Tissue Review</Text>
                      <Text style={styles.alertDesc}>Wagner Grade 3 osteitis probe evaluation.</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.connectCallBtn, { backgroundColor: '#1E3A8A' }]}
                      onPress={() => setInCall(true)}>
                      <Text style={styles.connectCallBtnText}>Connect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            OPTION 3: "Mobile Camera Capture Flow" (/mobile-simulator)
            (Inspected from live DOM: 3-Photo Protocol, Circular Calibrant,
             Live Network Telemetry, Physical Android Testing)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'camera_flow' && (
          <View style={styles.viewContainer}>
            <View style={styles.commandBanner}>
              <View style={styles.deptBadgeRow}>
                <Text style={styles.deptLabel}>LIVE INTERACTIVE EMULATOR</Text>
                <View style={styles.hubBadge}>
                  <Text style={styles.hubBadgeText}>FastAPI Port 8000</Text>
                </View>
              </View>
              <Text style={styles.commandTitle}>Mobile Field Application Simulator</Text>
              <Text style={styles.commandSubtitle}>
                Field Photography Protocol for ASHA Workers with real-time OpenCV segmentation and Wagner ML AI analysis.
              </Text>
            </View>

            {/* 3-Photo Protocol Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>📖 Field Photography Protocol for ASHA Workers</Text>
              <View style={styles.protocolStep}>
                <Text style={styles.stepNum}>1</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Overview Photo</Text>
                  <Text style={styles.stepDesc}>Full plantar aspect view covering anatomical landmark context.</Text>
                </View>
              </View>

              <View style={styles.protocolStep}>
                <Text style={styles.stepNum}>2</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Close-Up Photo</Text>
                  <Text style={styles.stepDesc}>High-detail macro focus on ulcer margins, depth, and slough.</Text>
                </View>
              </View>

              <View style={styles.protocolStep}>
                <Text style={styles.stepNum}>3</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>Calibrated Measurement Photo</Text>
                  <Text style={styles.stepDesc}>Place circular calibrant scale marker (15mm coin) alongside ulcer for exact px/mm dimensional calculation.</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.bigCaptureBtn}
                onPress={() => launchCamera('PAT_KGP_01')}>
                <Text style={styles.bigCaptureBtnText}>Start 3-Photo Protocol →</Text>
              </TouchableOpacity>
            </View>

            {/* Telemetry Status Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>📡 Live Mobile API Network Telemetry</Text>
              <Text style={styles.guideItem}>• Server Endpoint: http://192.168.31.94:8000 (Active)</Text>
              <Text style={styles.guideItem}>• OpenCV Calibrant Detector: Hough Circles (15.0 mm reference)</Text>
              <Text style={styles.guideItem}>• ML Model: PyTorch EfficientNet-B0 (wound_severity_best.pth)</Text>
              <Text style={styles.guideItem}>• Storage Directory: stored_photos/ & diabetescare.db</Text>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            OPTION 4: "Full Wound Trajectory" (/patients/PAT_KGP_01)
            (Inspected from live DOM: ABHA, CV Segmentation overlay toggle,
             Longitudinal healing curve, 10-Point Monofilament map, Care Advisory)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'trajectory' && (
          <View style={styles.viewContainer}>
            {/* Patient Header */}
            <View style={styles.commandBanner}>
              <View style={styles.deptBadgeRow}>
                <Text style={styles.deptLabel}>PATIENT CLINICAL DOSSIER</Text>
                <View style={styles.hubBadge}>
                  <Text style={styles.hubBadgeText}>ABHA: 91-8421-9982-1044</Text>
                </View>
              </View>
              <Text style={styles.commandTitle}>Ramesh Chandra Sen</Text>
              <Text style={styles.commandSubtitle}>
                58 yrs · Male · Type 2 Diabetes x 12 yrs · Kharagpur Rural, Paschim Medinipur
              </Text>
            </View>

            {/* Computer Vision Wound Segmentation Card with Toggle */}
            <View style={styles.card}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Computer Vision Wound Segmentation</Text>
                <View style={styles.deltaBadge}>
                  <Text style={styles.deltaBadgeText}>Wagner Grade {activePatient.wagner_grade}</Text>
                </View>
              </View>

              {/* View Toggle */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, showSegmentationOverlay && styles.toggleBtnActive]}
                  onPress={() => setShowSegmentationOverlay(true)}>
                  <Text style={[styles.toggleBtnText, showSegmentationOverlay && styles.toggleBtnTextActive]}>
                    AI Segmentation Overlay
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, !showSegmentationOverlay && styles.toggleBtnActive]}
                  onPress={() => setShowSegmentationOverlay(false)}>
                  <Text style={[styles.toggleBtnText, !showSegmentationOverlay && styles.toggleBtnTextActive]}>
                    Original Photo
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.previewBox}>
                <Text style={styles.previewBoxIcon}>🦶</Text>
                <Text style={styles.previewBoxTitle}>
                  {showSegmentationOverlay ? '🔬 AI Contour Saliency Active' : '📷 Original Clinical Photograph'}
                </Text>
                <Text style={styles.patDetails}>
                  {showSegmentationOverlay
                    ? `Identified Ulcer Bed: ${(activePatient.latest_wound_area_cm2 || 2.57).toFixed(2)} cm² · Calibrated px/mm`
                    : '15mm Circular Calibrant Scale Marker Detected'}
                </Text>
              </View>
            </View>

            {/* Longitudinal Healing Progression */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>Longitudinal Healing Progression</Text>
              <View style={styles.historyList}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyDate}>10 Aug (Baseline):</Text>
                  <Text style={[styles.historyVal, { color: RED }]}>5.20 cm²</Text>
                  <Text style={styles.historySub}>Superficial to tendon margin</Text>
                </View>
                <View style={styles.historyRow}>
                  <Text style={styles.historyDate}>18 Aug (Follow-up):</Text>
                  <Text style={[styles.historyVal, { color: AMBER }]}>3.90 cm²</Text>
                  <Text style={styles.historySub}>-25.0% Area Reduction</Text>
                </View>
                <View style={styles.historyRow}>
                  <Text style={styles.historyDate}>Latest Assessment:</Text>
                  <Text style={[styles.historyVal, { color: EMERALD }]}>
                    {(activePatient.latest_wound_area_cm2 || 2.57).toFixed(2)} cm²
                  </Text>
                  <Text style={styles.historySub}>
                    {activePatient.wagner_grade >= 2 ? 'Active Physician Monitoring' : 'Steady Healing Progress'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 10-Point Monofilament Map */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>🦶 10-Point Monofilament Map (Neuropathy)</Text>
              <Text style={styles.patDetails}>Tactile sensitivity assessment (5.07 / 10g Semmes-Weinstein test):</Text>
              <View style={styles.monoMapRow}>
                <View style={styles.monoItem}>
                  <Text style={styles.monoDotRed}>●</Text>
                  <Text style={styles.monoLabel}>Plantar Great Toe: Sensation Absent</Text>
                </View>
                <View style={styles.monoItem}>
                  <Text style={styles.monoDotRed}>●</Text>
                  <Text style={styles.monoLabel}>1st Metatarsal: Sensation Absent</Text>
                </View>
                <View style={styles.monoItem}>
                  <Text style={styles.monoDotGreen}>●</Text>
                  <Text style={styles.monoLabel}>Heel & Midfoot: Normal Perception</Text>
                </View>
              </View>
            </View>

            {/* AI Clinical Care Plan Advisory */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>AI Clinical Care Plan Advisory</Text>
              <Text style={styles.guideItem}>• Total Contact Casting (TCC) or rigid diabetic rocker shoe offloading.</Text>
              <Text style={styles.guideItem}>• Normal saline irrigation + hydrocolloid foam barrier dressing.</Text>
              <Text style={styles.guideItem}>• Weekly serial photography with circular calibrant marker.</Text>
              <TouchableOpacity
                style={[styles.bigCaptureBtn, { marginTop: 8 }]}
                onPress={() => openOverride(COHORT_PATIENTS[0])}>
                <Text style={styles.bigCaptureBtnText}>✍️ Record Doctor Override</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            OPTION 5: "My Care Preferences" (/settings)
            (Inspected from live DOM: Hospital & Department affiliation,
             Clinical escalation & dispatch SMS toggles, Save profile)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'care_preferences' && (
          <View style={styles.viewContainer}>
            <View style={styles.commandBanner}>
              <Text style={styles.deptLabel}>SYSTEM & PRACTICE MANAGEMENT</Text>
              <Text style={styles.commandTitle}>Hospital & Practitioner Settings</Text>
              <Text style={styles.commandSubtitle}>
                Configure departmental triage thresholds, notification channels, and DPDP Act data rights.
              </Text>
            </View>

            {/* Hospital & Department Affiliation */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>HOSPITAL & DEPARTMENT AFFILIATION</Text>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Hospital Institution:</Text>
                <TextInput
                  style={styles.modalInput}
                  value="Midnapore Medical College & Hospital (MMCH)"
                  editable={false}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Clinical Department:</Text>
                <TextInput
                  style={styles.modalInput}
                  value="Department of Diabetology & Podiatric Surgery"
                  editable={false}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Preferred Language:</Text>
                <View style={styles.langPillsRow}>
                  {['English', 'বাংলা (Bengali)', 'हिन्दी (Hindi)'].map(l => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.filterPill, selectedLang === l && styles.filterPillActive]}
                      onPress={() => setSelectedLang(l)}>
                      <Text style={[styles.filterPillText, selectedLang === l && styles.filterPillTextActive]}>
                        {l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Clinical Escalation & Dispatch */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>CLINICAL ESCALATION & DISPATCH</Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>SMS Alerts on RED Triage</Text>
                  <Text style={styles.patDetails}>Immediate SMS notification for ulcer enlargement or osteitis</Text>
                </View>
                <Switch
                  value={smsAlertsEnabled}
                  onValueChange={setSmsAlertsEnabled}
                  trackColor={{ false: '#334155', true: BLUE_BTN }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Daily Morning Clinical Digest</Text>
                  <Text style={styles.patDetails}>Summary of overnight field captures and healing trajectories</Text>
                </View>
                <Switch
                  value={emailDigestsEnabled}
                  onValueChange={setEmailDigestsEnabled}
                  trackColor={{ false: '#334155', true: BLUE_BTN }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Auto-Escalate Unacknowledged Alerts</Text>
                  <Text style={styles.patDetails}>Escalate RED alerts to On-Call Diabetologist after 4 hours</Text>
                </View>
                <Switch
                  value={autoEscalateEnabled}
                  onValueChange={setAutoEscalateEnabled}
                  trackColor={{ false: '#334155', true: BLUE_BTN }}
                />
              </View>

              <TouchableOpacity
                style={styles.bigCaptureBtn}
                onPress={() => Alert.alert('Settings Saved', 'Practice profile and department affiliation saved successfully.')}>
                <Text style={styles.bigCaptureBtnText}>Save Practice Profile & Department Affiliation</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CLINICAL TRIAGE COMMAND HUB VIEW (From user screenshot)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'triage' && (
          <View style={styles.viewContainer}>
            <View style={styles.commandBanner}>
              <View style={{ flex: 1 }}>
                <View style={styles.deptBadgeRow}>
                  <Text style={styles.deptLabel}>DEPARTMENT OF DIABETOLOGY & PODIATRIC SURGERY</Text>
                  <View style={styles.hubBadge}>
                    <Text style={styles.hubBadgeText}>Apex Hub: Midnapore Medical College</Text>
                  </View>
                </View>
                <Text style={styles.commandTitle}>Clinical Decision Support & Ulcer Triage Command</Text>
                <Text style={styles.commandSubtitle}>
                  Active patient cohort registry, multi-visit wound area reduction tracking, and urgent clinical escalation queue.
                </Text>
              </View>
              <View style={styles.bannerActionRow}>
                <TouchableOpacity
                  style={styles.bannerTeleBtn}
                  onPress={() => setActiveTab('teleconsult')}>
                  <Text style={styles.bannerTeleBtnText}>📹 National Teleconsult</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bannerInfoBtn}
                  onPress={() => setActiveTab('informatics')}>
                  <Text style={styles.bannerInfoBtnText}>📊 AI Informatics</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4 Stat Metric Cards */}
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <View style={styles.statTop}>
                  <Text style={styles.statLabel}>ACTIVE COHORT</Text>
                  <Text style={styles.statEmoji}>👥</Text>
                </View>
                <Text style={styles.statVal}>{cohortPatients.length} Enrolled</Text>
                <Text style={styles.statSub}>Assigned to Lead Diabetologist</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statTop}>
                  <Text style={styles.statLabel}>URGENT TRIAGE ALERTS</Text>
                  <Text style={styles.statEmoji}>🚨</Text>
                </View>
                <Text style={[styles.statVal, { color: RED }]}>{liveAlerts.length > 0 ? liveAlerts.length : 2} Unresolved</Text>
                <Text style={styles.statSub}>Requires immediate physician review</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statTop}>
                  <Text style={styles.statLabel}>TELECONSULT QUEUE</Text>
                  <Text style={styles.statEmoji}>📹</Text>
                </View>
                <Text style={styles.statVal}>1 Scheduled</Text>
                <Text style={styles.statSub}>eSanjeevani / ABDM Verified</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statTop}>
                  <Text style={styles.statLabel}>MEAN HEALING VELOCITY</Text>
                  <Text style={styles.statEmoji}>📈</Text>
                </View>
                <Text style={[styles.statVal, { color: EMERALD }]}>74.2%</Text>
                <Text style={styles.statSub}>Surface area reduction rate</Text>
              </View>
            </View>

            {/* 30-Day Trajectory Graph & Urgent Alerts */}
            <View style={styles.chartAndAlertsGrid}>
              <View style={styles.chartCard}>
                <View style={styles.chartHeaderRow}>
                  <View>
                    <Text style={styles.cardHeaderTitle}>Cohort Mean Ulcer Area Reduction (30-Day Trajectory)</Text>
                    <Text style={styles.cardHeaderSub}>
                      Calculated via automated circular calibrant scale marker (px/mm calibration)
                    </Text>
                  </View>
                  <View style={styles.deltaBadge}>
                    <Text style={styles.deltaBadgeText}>-65.4% Delta</Text>
                  </View>
                </View>

                <View style={styles.barsContainer}>
                  {TRAJECTORY_DATA.map((pt, idx) => {
                    const maxHeight = 100;
                    const heightPercent = (pt.area / 6.0) * maxHeight;
                    return (
                      <View key={idx} style={styles.barCol}>
                        <Text style={styles.barValText}>{pt.area} cm²</Text>
                        <View style={[styles.barVisual, { height: heightPercent }]} />
                        <Text style={styles.barDateText}>{pt.date}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.urgentAlertsCard}>
                <View style={styles.chartHeaderRow}>
                  <Text style={styles.cardHeaderTitle}>🚨 Urgent Alert Triage</Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{liveAlerts.length > 0 ? `${liveAlerts.length} Pending` : '2 Pending'}</Text>
                  </View>
                </View>

                {liveAlerts.length > 0 ? (
                  liveAlerts.slice(0, 3).map((a, idx) => (
                    <View key={a.id || idx} style={styles.alertItem}>
                      <View style={styles.alertItemHeader}>
                        <Text style={styles.alertPatientName}>{a.patient_name || a.patient_id}</Text>
                        <View style={[styles.redBadge, a.severity !== 'HIGH' && { backgroundColor: AMBER }]}>
                          <Text style={styles.redBadgeText}>{a.severity || 'RED'}</Text>
                        </View>
                      </View>
                      <Text style={styles.alertDesc}>{a.message}</Text>
                      <View style={styles.alertFooter}>
                        <Text style={styles.alertTime}>{a.timestamp ? a.timestamp.slice(11, 16) : 'Just now'}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const target = cohortPatients.find(p => p.patient_id === a.patient_id) || cohortPatients[0];
                            openOverride(target);
                          }}>
                          <Text style={styles.alertLink}>Review Record →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <>
                    <View style={styles.alertItem}>
                      <View style={styles.alertItemHeader}>
                        <Text style={styles.alertPatientName}>Ramesh Chandra Sen</Text>
                        <View style={styles.redBadge}>
                          <Text style={styles.redBadgeText}>RED</Text>
                        </View>
                      </View>
                      <Text style={styles.alertDesc}>
                        Ulcer surface area enlargement detected (+14.2% increase compared to baseline). Immediate offloading advisory required.
                      </Text>
                      <View style={styles.alertFooter}>
                        <Text style={styles.alertTime}>2 hrs ago</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const pat = cohortPatients[0];
                            openOverride(pat);
                          }}>
                          <Text style={styles.alertLink}>Review Record →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.alertItem}>
                      <View style={styles.alertItemHeader}>
                        <Text style={styles.alertPatientName}>Lakshmi Narayan Paul</Text>
                        <View style={styles.redBadge}>
                          <Text style={styles.redBadgeText}>RED</Text>
                        </View>
                      </View>
                      <Text style={styles.alertDesc}>
                        Wagner Grade 3 deep tissue probe positive with secondary purulent drainage. Vascular referral recommended.
                      </Text>
                      <View style={styles.alertFooter}>
                        <Text style={styles.alertTime}>2 hrs ago</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const pat = cohortPatients[3] || cohortPatients[0];
                            openOverride(pat);
                          }}>
                          <Text style={styles.alertLink}>Review Record →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Department Patient Cohort Registry */}
            <View style={styles.registryCard}>
              <View style={styles.registryHeaderRow}>
                <View>
                  <Text style={styles.cardHeaderTitle}>
                    Department Patient Cohort Registry ({filteredPatients.length} Shown)
                  </Text>
                  <Text style={styles.cardHeaderSub}>
                    Filter clinical records by triage severity, Wagner classification, and regional district.
                  </Text>
                </View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, MRN, phone..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Filter Pills */}
              <View style={styles.filterPillsRow}>
                <Text style={styles.filterLabel}>URGENCY:</Text>
                {['ALL', 'HIGH', 'MEDIUM'].map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.filterPill, selectedUrgency === u && styles.filterPillActive]}
                    onPress={() => setSelectedUrgency(u)}>
                    <Text style={[styles.filterPillText, selectedUrgency === u && styles.filterPillTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}

                <Text style={[styles.filterLabel, { marginLeft: 10 }]}>WAGNER:</Text>
                {['ALL', '1', '2', '3'].map(w => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.filterPill, selectedWagner === w && styles.filterPillActive]}
                    onPress={() => setSelectedWagner(w)}>
                    <Text style={[styles.filterPillText, selectedWagner === w && styles.filterPillTextActive]}>
                      {w === 'ALL' ? 'ALL' : `Grade ${w}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Patient Cards List */}
              {filteredPatients.map(pat => (
                <View key={pat.patient_id} style={styles.patientRowCard}>
                  <View style={styles.patMainInfo}>
                    <View style={styles.patNameRow}>
                      <Text style={styles.patName}>{pat.name}</Text>
                      <View
                        style={[
                          styles.urgencyBadge,
                          {
                            backgroundColor:
                              pat.urgency === 'HIGH' ? `${RED}22` : `${AMBER}22`,
                            borderColor:
                              pat.urgency === 'HIGH' ? RED : AMBER,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.urgencyBadgeText,
                            { color: pat.urgency === 'HIGH' ? RED : AMBER },
                          ]}>
                          {pat.urgency}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.patDetails}>
                      {pat.patient_id} · {pat.age}y/{pat.gender} · {pat.village}, {pat.district}
                    </Text>
                    <View style={styles.wagnerTagRow}>
                      <View style={styles.wagnerBadge}>
                        <Text style={styles.wagnerBadgeText}>Wagner Grade {pat.wagner_grade}</Text>
                      </View>
                      <Text style={styles.latestWoundArea}>
                        Area: {pat.latest_wound_area_cm2} cm²
                      </Text>
                    </View>
                  </View>

                  <View style={styles.patActionsCol}>
                    <TouchableOpacity
                      style={styles.actionBtnSmall}
                      onPress={() => openOverride(pat)}>
                      <Text style={styles.actionBtnSmallText}>Override</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtnSmall, { backgroundColor: '#1E3A8A' }]}
                      onPress={() => launchCamera(pat.patient_id)}>
                      <Text style={styles.actionBtnSmallText}>Capture</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            INFORMATICS VIEW
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'informatics' && (
          <View style={styles.viewContainer}>
            <View style={styles.commandBanner}>
              <Text style={styles.deptLabel}>CLINICAL AI BENCHMARKS</Text>
              <Text style={styles.commandTitle}>Informatics & Deep Learning Model Health</Text>
              <Text style={styles.commandSubtitle}>
                Rigorous Week 5 test evaluations and latency metrics across our multi-model ensemble.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>🔬 EfficientNet-B0 (Wagner Severity Classifier)</Text>
              <View style={styles.modelMetricRow}>
                <View style={styles.modelMetricBox}>
                  <Text style={styles.modelMetricVal}>95.0%</Text>
                  <Text style={styles.modelMetricLabel}>Accuracy</Text>
                </View>
                <View style={styles.modelMetricBox}>
                  <Text style={styles.modelMetricVal}>0.9000</Text>
                  <Text style={styles.modelMetricLabel}>Cohen's Kappa</Text>
                </View>
                <View style={styles.modelMetricBox}>
                  <Text style={styles.modelMetricVal}>0.9908</Text>
                  <Text style={styles.modelMetricLabel}>AUROC</Text>
                </View>
                <View style={styles.modelMetricBox}>
                  <Text style={styles.modelMetricVal}>185ms</Text>
                  <Text style={styles.modelMetricLabel}>Inference Latency</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>🩻 Supporting Model Pipeline</Text>
              <Text style={styles.guideItem}>• ResNet-18 Cellulitis Classifier: 97.4% Sensitivity, 95.8% Specificity</Text>
              <Text style={styles.guideItem}>• SAM2 & Adaptive Contour Saliency: 0.923 Dice Score, px/mm calibrated</Text>
              <Text style={styles.guideItem}>• Clinical NLP Pipeline: spaCy 87 medical entity rules with negation detection</Text>
              <Text style={styles.guideItem}>• Multimodal LLM: Gemini 1.5 Pro Vision risk scoring with Pydantic guardrails</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Doctor Override Modal ── */}
      <Modal visible={overrideModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Authoritative Doctor Override</Text>
            <Text style={styles.modalSub}>
              Patient: {overridePatient?.name} ({overridePatient?.patient_id})
            </Text>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Length (mm):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={overrideLength}
                onChangeText={setOverrideLength}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Width (mm):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={overrideWidth}
                onChangeText={setOverrideWidth}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Surface Area (cm²):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={overrideArea}
                onChangeText={setOverrideArea}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Clinical Notes:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                multiline
                placeholder="Reason for override..."
                placeholderTextColor="#64748B"
                value={overrideNotes}
                onChangeText={setOverrideNotes}
              />
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#334155' }]}
                onPress={() => setOverrideModalVisible(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: BLUE_BTN }]}
                onPress={saveOverride}>
                <Text style={styles.modalBtnText}>Save Override</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: NAVY_BG,
  },
  topHeader: {
    height: 52,
    backgroundColor: SIDEBAR_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleTag: {
    backgroundColor: '#16254A',
    borderColor: '#253966',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTagText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  topFacilityText: {
    color: TEXT_MUTED,
    fontSize: 10,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileSimBtn: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mobileSimBtnText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
  },
  fastApiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EMERALD,
  },
  fastApiText: {
    color: '#CBD5E1',
    fontSize: 10,
  },
  navBar: {
    backgroundColor: '#0C152E',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  navBarScroll: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#111C38',
  },
  navTabActive: {
    backgroundColor: BLUE_BTN,
  },
  navTabIcon: {
    fontSize: 12,
  },
  navTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  navTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mainScroll: {
    padding: 12,
    paddingBottom: 40,
  },
  viewContainer: {
    gap: 12,
  },
  commandBanner: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  deptBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  deptLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.8,
  },
  hubBadge: {
    backgroundColor: '#1E3A8A44',
    borderColor: '#3B82F666',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hubBadgeText: {
    color: '#93C5FD',
    fontSize: 9,
    fontWeight: '700',
  },
  commandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  commandSubtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 15,
  },
  bannerActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  bannerTeleBtn: {
    backgroundColor: BLUE_BTN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  bannerTeleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bannerInfoBtn: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  bannerInfoBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 10,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 0.5,
  },
  statEmoji: {
    fontSize: 13,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statSub: {
    fontSize: 9,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  chartAndAlertsGrid: {
    gap: 10,
  },
  chartCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardHeaderSub: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginTop: 1,
  },
  deltaBadge: {
    backgroundColor: '#1E3A8A44',
    borderColor: '#3B82F666',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaBadgeText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 110,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2E56',
  },
  barCol: {
    alignItems: 'center',
    gap: 4,
  },
  barValText: {
    color: '#93C5FD',
    fontSize: 9,
    fontWeight: '700',
  },
  barVisual: {
    width: 22,
    backgroundColor: BLUE_BTN,
    borderRadius: 4,
  },
  barDateText: {
    color: TEXT_MUTED,
    fontSize: 9,
    marginTop: 2,
  },
  urgentAlertsCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  pendingBadge: {
    backgroundColor: '#7F1D1D44',
    borderColor: '#DC262666',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '700',
  },
  alertItem: {
    backgroundColor: SUB_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  alertItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertPatientName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  redBadge: {
    backgroundColor: '#991B1B44',
    borderColor: RED,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  redBadgeText: {
    color: RED,
    fontSize: 9,
    fontWeight: '800',
  },
  alertDesc: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 15,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  alertTime: {
    fontSize: 9,
    color: TEXT_MUTED,
  },
  alertLink: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
  },
  registryCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  registryHeaderRow: {
    gap: 6,
  },
  searchInput: {
    backgroundColor: '#091024',
    borderWidth: 1,
    borderColor: '#22335A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 11,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  filterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: TEXT_MUTED,
  },
  filterPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#0C152E',
    borderWidth: 1,
    borderColor: '#1E2E56',
  },
  filterPillActive: {
    backgroundColor: BLUE_BTN,
    borderColor: BLUE_BTN,
  },
  filterPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  patientRowCard: {
    backgroundColor: SUB_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  patMainInfo: {
    flex: 1,
    gap: 2,
  },
  patNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  urgencyBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  urgencyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  patDetails: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  wagnerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  wagnerBadge: {
    backgroundColor: '#1E3A8A44',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  wagnerBadgeText: {
    color: '#93C5FD',
    fontSize: 9,
    fontWeight: '700',
  },
  latestWoundArea: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  patActionsCol: {
    gap: 4,
    marginLeft: 8,
  },
  actionBtnSmall: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    alignItems: 'center',
  },
  actionBtnSmallText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sosCard: {
    backgroundColor: '#450A0A',
    borderWidth: 1.5,
    borderColor: RED,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sosTitle: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
  },
  sosSubtitle: {
    color: '#FECACA',
    fontSize: 10,
    marginTop: 2,
  },
  sosBtn: {
    backgroundColor: RED,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  progressSubText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#1E293B',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: EMERALD,
    borderRadius: 5,
  },
  prescriptionBox: {
    backgroundColor: SUB_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  prescripDrug: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  prescripDosage: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
  },
  prescripInst: {
    color: TEXT_MUTED,
    fontSize: 10,
  },
  bigCaptureBtn: {
    backgroundColor: BLUE_BTN,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  bigCaptureBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  protocolStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: SUB_CARD,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BLUE_BTN,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '800',
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepDesc: {
    color: TEXT_MUTED,
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleBtnActive: {
    backgroundColor: BLUE_BTN,
    borderColor: BLUE_BTN,
  },
  toggleBtnText: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  previewBox: {
    height: 130,
    backgroundColor: '#020617',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
  },
  previewBoxIcon: {
    fontSize: 32,
  },
  previewBoxTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SUB_CARD,
    padding: 8,
    borderRadius: 6,
  },
  historyDate: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  historyVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  historySub: {
    color: TEXT_MUTED,
    fontSize: 10,
  },
  monoMapRow: {
    gap: 4,
    marginTop: 4,
  },
  monoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monoDotRed: {
    color: RED,
    fontSize: 12,
  },
  monoDotGreen: {
    color: EMERALD,
    fontSize: 12,
  },
  monoLabel: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  langPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  guideItem: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
  },
  videoRoomCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  remoteVideoArea: {
    height: 180,
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    justifyContent: 'space-between',
    position: 'relative',
  },
  remoteVideoUser: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#064E3B',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#A7F3D0',
    fontSize: 9,
    fontWeight: '800',
  },
  selfVideoArea: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 90,
    height: 70,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfVideoText: {
    color: '#CBD5E1',
    fontSize: 8,
    textAlign: 'center',
  },
  callControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  callControlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 2,
  },
  callControlBtnActive: {
    backgroundColor: '#7F1D1D',
    borderColor: RED,
  },
  callControlIcon: {
    fontSize: 16,
  },
  callControlLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  callNotesSection: {
    marginTop: 4,
    gap: 4,
  },
  notesInput: {
    backgroundColor: '#091024',
    borderWidth: 1,
    borderColor: '#22335A',
    borderRadius: 8,
    padding: 8,
    color: '#FFFFFF',
    fontSize: 11,
    textAlignVertical: 'top',
  },
  queueItem: {
    backgroundColor: SUB_CARD,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  queuePatient: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  connectCallBtn: {
    backgroundColor: BLUE_BTN,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  connectCallBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  modelMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  modelMetricBox: {
    flex: 1,
    backgroundColor: SUB_CARD,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  modelMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: EMERALD,
  },
  modelMetricLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSub: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  modalField: {
    gap: 2,
  },
  modalFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93C5FD',
  },
  modalInput: {
    backgroundColor: '#091024',
    borderWidth: 1,
    borderColor: '#22335A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: '#FFFFFF',
    fontSize: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
