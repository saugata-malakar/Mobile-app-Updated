// mobile-app/src/screens/PortalLoginScreen.tsx
// Comprehensive Portal Gateway & Role Login Screen matching doctor-dashboard-mu.vercel.app

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const NAVY_BG   = '#0B132B';
const CARD_BG   = '#111C38';
const BORDER    = '#23355E';
const BLUE_BTN  = '#2563EB';
const EMERALD   = '#10B981';
const AMBER     = '#F59E0B';
const RED       = '#EF4444';
const INDIGO    = '#6366F1';
const TEXT_MUTED = '#94A3B8';

export interface UserPersona {
  role: 'doctor' | 'patient' | 'asha' | 'hospital_admin';
  name: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: string;
  mrnOrId: string;
  facility: string;
}

const PERSONAS: UserPersona[] = [
  {
    role: 'doctor',
    name: 'Dr. Clinical Specialist',
    title: 'Lead Diabetologist & Podiatric Surgeon',
    badge: 'Physician Command',
    badgeColor: BLUE_BTN,
    description: 'Clinical decision triage, urgent ulcer alerts, multi-visit wound trajectories & doctor overrides.',
    icon: '👨‍⚕️',
    mrnOrId: 'DOC_IITKGP_01',
    facility: 'Midnapore Apex Hub · Node #01',
  },
  {
    role: 'patient',
    name: 'Ramesh Chandra Sen',
    title: 'Enrolled Cohort Patient',
    badge: 'Patient Portal',
    badgeColor: EMERALD,
    description: 'My Healing Journey, personal ulcer trajectory, medication guide & Govt eSanjeevani teleconsult.',
    icon: '🩹',
    mrnOrId: 'MRN: PAT_KGP_01',
    facility: 'Kharagpur Rural · Paschim Medinipur',
  },
  {
    role: 'asha',
    name: 'Sunita Murmu',
    title: 'ASHA Field Health Worker',
    badge: 'Field Workforce',
    badgeColor: AMBER,
    description: 'Patient field intake, circular calibrant AI photography, offline queue & cloud synchronization.',
    icon: '👩‍⚕️',
    mrnOrId: 'ASHA_WB_0042',
    facility: 'Kharagpur Rural Sub-Centre',
  },
  {
    role: 'hospital_admin',
    name: 'Midnapore Apex Hub Admin',
    title: 'Hospital Operations & Governance',
    badge: 'Statutory Oversight',
    badgeColor: INDIGO,
    description: 'Hospital throughput, DPDP statutory consent audit, right-to-erasure logs & ML model informatics.',
    icon: '🏥',
    mrnOrId: 'ADMIN_MMCH_01',
    facility: 'Midnapore Medical College & Hospital',
  },
];

export default function PortalLoginScreen() {
  const navigation = useNavigation<any>();
  const [selectedRole, setSelectedRole] = useState<'doctor' | 'patient' | 'asha' | 'hospital_admin'>('doctor');

  const handleLogin = (persona: UserPersona) => {
    navigation.navigate('DoctorCommandHub', {
      userRole: persona.role,
      userProfile: persona,
    });
  };

  const handleQuickCamera = () => {
    navigation.navigate('PatientRegistration');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY_BG} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Institution Header ── */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <Text style={styles.appTitle}>DiabetesCare AI</Text>
          </View>
          <Text style={styles.institution}>IIT Kharagpur & MMCH</Text>
          <Text style={styles.headline}>
            Clinical Decision Support & Multi-Role Mobile Command Portal
          </Text>
        </View>

        {/* ── Server Status Badge ── */}
        <View style={styles.statusBanner}>
          <View style={styles.onlineDot} />
          <Text style={styles.statusText}>
            FastAPI Port 8000 Connected · Midnapore Apex Hub Node #01
          </Text>
        </View>

        {/* ── Role Selection Guide ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SELECT SYSTEM ACCESS PERSONA</Text>
          <Text style={styles.sectionSubtitle}>
            Simulate and interact with the complete system from any stakeholder perspective:
          </Text>
        </View>

        {/* ── Persona Cards ── */}
        {PERSONAS.map(p => {
          const isSelected = selectedRole === p.role;
          return (
            <TouchableOpacity
              key={p.role}
              activeOpacity={0.85}
              style={[
                styles.personaCard,
                isSelected && { borderColor: p.badgeColor, borderWidth: 1.5 },
              ]}
              onPress={() => {
                setSelectedRole(p.role);
                handleLogin(p);
              }}>
              <View style={styles.cardTopRow}>
                <View style={styles.iconContainer}>
                  <Text style={styles.personaIcon}>{p.icon}</Text>
                </View>
                <View style={styles.personaMeta}>
                  <View style={styles.nameBadgeRow}>
                    <Text style={styles.personaName}>{p.name}</Text>
                    <View style={[styles.badge, { backgroundColor: `${p.badgeColor}22`, borderColor: `${p.badgeColor}66` }]}>
                      <Text style={[styles.badgeText, { color: p.badgeColor }]}>{p.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.personaTitle}>{p.title}</Text>
                  <Text style={styles.personaFacility}>📍 {p.facility}</Text>
                </View>
              </View>

              <Text style={styles.personaDesc}>{p.description}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.idText}>{p.mrnOrId}</Text>
                <View style={[styles.enterBtn, { backgroundColor: p.badgeColor }]}>
                  <Text style={styles.enterBtnText}>Launch Portal →</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Direct Camera Shortcut ── */}
        <View style={styles.cameraBannerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cameraBannerTitle}>📸 Need to capture a patient wound right now?</Text>
            <Text style={styles.cameraBannerDesc}>
              Directly launch the circular calibrant camera with OpenCV measurements & Wagner ML AI classification.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cameraActionBtn}
            onPress={handleQuickCamera}>
            <Text style={styles.cameraActionBtnText}>Launch Camera Flow</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: NAVY_BG,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BLUE_BTN,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  institution: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginTop: 2,
  },
  headline: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 17,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F2347',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1D3B72',
    marginBottom: 16,
    justifyContent: 'center',
    gap: 8,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EMERALD,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
    lineHeight: 16,
  },
  personaCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#162347',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#22386E',
  },
  personaIcon: {
    fontSize: 22,
  },
  personaMeta: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  personaName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  personaTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 2,
  },
  personaFacility: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  personaDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    marginTop: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#19284F',
  },
  idText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#64748B',
  },
  enterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  enterBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cameraBannerCard: {
    backgroundColor: '#0F2C4C',
    borderWidth: 1,
    borderColor: '#1E4D7E',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  cameraBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#93C5FD',
  },
  cameraBannerDesc: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 4,
    lineHeight: 16,
  },
  cameraActionBtn: {
    marginTop: 10,
    backgroundColor: '#2563EB',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
