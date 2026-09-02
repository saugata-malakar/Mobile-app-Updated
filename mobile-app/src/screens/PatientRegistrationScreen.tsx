// mobile-app/src/screens/PatientRegistrationScreen.tsx
// Patient registration + consent collection for ASHA workers

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DiabetesCareAPI, PatientRegisterPayload } from '../services/api';

const NAVY  = '#1F3864';
const GREEN = '#2ECC71';
const WHITE = '#FFFFFF';
const GREY  = '#F5F6FA';
const RED   = '#E74C3C';

const CONSENT_TYPES = [
  { key: 'clinical',    label: 'Clinical Care',     desc: 'Data used for your medical treatment.' },
  { key: 'research',    label: 'Research Use',       desc: 'Anonymised data used for health research.' },
  { key: 'ai_training', label: 'AI Model Training',  desc: 'Your images help train diagnostic AI models.' },
];

const DIABETES_TYPES = [
  { key: 'type2',       label: 'Type 2' },
  { key: 'type1',       label: 'Type 1' },
  { key: 'gestational', label: 'Gestational' },
  { key: 'unknown',     label: 'Unknown' },
];

const GENDER_OPTIONS = [
  { key: 'male',   label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other',  label: 'Other' },
];

export default function PatientRegistrationScreen() {
  const navigation = useNavigation<any>();

  // ── Form state ────────────────────────────────────────────────────────────
  const [fullName,    setFullName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [age,         setAge]         = useState('');
  const [gender,      setGender]      = useState<string>('female');
  const [district,    setDistrict]    = useState('');
  const [diabetesType, setDiabetesType] = useState('type2');
  const [hba1c,       setHba1c]       = useState('');
  const [bpSys,       setBpSys]       = useState('');
  const [bpDia,       setBpDia]       = useState('');
  const [operatorId,  setOperatorId]  = useState('');
  const [consents,    setConsents]    = useState<Record<string, boolean>>({
    clinical: true, research: false, ai_training: false,
  });
  const [submitting, setSubmitting]   = useState(false);

  const toggleConsent = useCallback((key: string) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!fullName.trim()) return 'Patient name is required.';
    if (!age || isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120)
      return 'Valid age (1–120) is required.';
    if (!consents.clinical)
      return 'Clinical consent is required to collect data.';
    if (!operatorId.trim())
      return 'Please enter your ASHA worker / operator ID.';
    return null;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Missing Information', err); return; }

    setSubmitting(true);
    try {
      const payload: PatientRegisterPayload = {
        full_name:      fullName.trim(),
        phone:          phone.trim() || undefined,
        age:            Number(age),
        gender:         gender as any,
        district:       district.trim() || undefined,
        diabetes_type:  diabetesType as any,
        hba1c:          hba1c ? parseFloat(hba1c) : undefined,
        bp_systolic:    bpSys ? parseInt(bpSys) : undefined,
        bp_diastolic:   bpDia ? parseInt(bpDia) : undefined,
        consents_granted: Object.entries(consents)
          .filter(([, v]) => v).map(([k]) => k),
        registered_by:  operatorId.trim(),
      };

      const res = await DiabetesCareAPI.registerPatient(payload);

      // Create first visit immediately
      const visit = await DiabetesCareAPI.createVisit({
        patient_id:   res.patient_id,
        conducted_by: operatorId.trim(),
        location:     district.trim() || undefined,
      });

      // Navigate to photo capture flow
      navigation.navigate('PhotoFlow', {
        patientId:  res.patient_id,
        visitId:    visit.visit_id,
        operatorId: operatorId.trim(),
      });

    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [fullName, phone, age, gender, district, diabetesType,
      hba1c, bpSys, bpDia, consents, operatorId]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <Text style={styles.title}>Patient Registration</Text>
          <Text style={styles.subtitle}>DiabetesCare AI · ORELA Lab, IIT Kharagpur</Text>
        </View>

        {/* ── Operator ID ───────────────────────────────────────────────── */}
        <Section title="Operator">
          <Field label="Your ASHA Worker / Operator ID *">
            <TextInput style={styles.input} value={operatorId}
              onChangeText={setOperatorId} placeholder="e.g. ASHA_WB_0042" />
          </Field>
        </Section>

        {/* ── Patient Info ──────────────────────────────────────────────── */}
        <Section title="Patient Information">
          <Field label="Full Name *">
            <TextInput style={styles.input} value={fullName}
              onChangeText={setFullName} placeholder="Patient full name"
              autoCapitalize="words" />
          </Field>
          <Field label="Phone Number">
            <TextInput style={styles.input} value={phone}
              onChangeText={setPhone} placeholder="+91 XXXXXXXXXX"
              keyboardType="phone-pad" />
          </Field>
          <View style={styles.row}>
            <Field label="Age *" flex={1}>
              <TextInput style={styles.input} value={age}
                onChangeText={setAge} placeholder="Age"
                keyboardType="number-pad" />
            </Field>
            <View style={{ width: 12 }} />
            <Field label="District" flex={2}>
              <TextInput style={styles.input} value={district}
                onChangeText={setDistrict} placeholder="e.g. Paschim Medinipur" />
            </Field>
          </View>

          <Field label="Gender">
            <View style={styles.optionRow}>
              {GENDER_OPTIONS.map(g => (
                <OptionChip
                  key={g.key}
                  label={g.label}
                  selected={gender === g.key}
                  onPress={() => setGender(g.key)}
                />
              ))}
            </View>
          </Field>
        </Section>

        {/* ── Diabetes Profile ──────────────────────────────────────────── */}
        <Section title="Diabetes Profile">
          <Field label="Diabetes Type">
            <View style={styles.optionRow}>
              {DIABETES_TYPES.map(d => (
                <OptionChip
                  key={d.key}
                  label={d.label}
                  selected={diabetesType === d.key}
                  onPress={() => setDiabetesType(d.key)}
                />
              ))}
            </View>
          </Field>
          <View style={styles.row}>
            <Field label="HbA1c %" flex={1}>
              <TextInput style={styles.input} value={hba1c}
                onChangeText={setHba1c} placeholder="e.g. 8.5"
                keyboardType="decimal-pad" />
            </Field>
            <View style={{ width: 12 }} />
            <Field label="BP Systolic" flex={1}>
              <TextInput style={styles.input} value={bpSys}
                onChangeText={setBpSys} placeholder="mmHg"
                keyboardType="number-pad" />
            </Field>
            <View style={{ width: 12 }} />
            <Field label="BP Diastolic" flex={1}>
              <TextInput style={styles.input} value={bpDia}
                onChangeText={setBpDia} placeholder="mmHg"
                keyboardType="number-pad" />
            </Field>
          </View>
        </Section>

        {/* ── Consent ───────────────────────────────────────────────────── */}
        <Section title="Consent (DPDP Act 2023)">
          <Text style={styles.consentNote}>
            Explain each option to the patient before collecting consent.
          </Text>
          {CONSENT_TYPES.map(c => (
            <View key={c.key} style={styles.consentRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.consentLabel}>{c.label}</Text>
                <Text style={styles.consentDesc}>{c.desc}</Text>
              </View>
              <Switch
                value={!!consents[c.key]}
                onValueChange={() => toggleConsent(c.key)}
                trackColor={{ true: NAVY, false: '#DDD' }}
                thumbColor={WHITE}
              />
            </View>
          ))}
        </Section>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}>
          {submitting
            ? <ActivityIndicator color={WHITE} />
            : <Text style={styles.submitText}>Register & Start Photo Collection</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label, children, flex,
}: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <View style={{ flex, marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function OptionChip({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: GREY },
  content:         { padding: 16, paddingBottom: 48 },

  header:          { marginBottom: 20 },
  title:           { fontSize: 24, fontWeight: '800', color: NAVY },
  subtitle:        { fontSize: 13, color: '#888', marginTop: 4 },

  section: {
    backgroundColor: WHITE, borderRadius: 14,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: NAVY, marginBottom: 14 },

  row:             { flexDirection: 'row' },
  fieldLabel:      { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222', backgroundColor: WHITE,
  },

  optionRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5, borderColor: '#CCC', borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  chipSelected:    { borderColor: NAVY, backgroundColor: NAVY },
  chipText:        { fontSize: 13, color: '#555' },
  chipTextSelected:{ color: WHITE, fontWeight: '700' },

  consentNote:     { fontSize: 12, color: '#888', marginBottom: 12 },
  consentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  consentLabel:    { fontSize: 14, fontWeight: '600', color: '#333' },
  consentDesc:     { fontSize: 12, color: '#888', marginTop: 2 },

  submitButton: {
    backgroundColor: NAVY, borderRadius: 12,
    paddingVertical: 17, alignItems: 'center', marginTop: 8,
  },
  submitText:      { color: WHITE, fontWeight: '800', fontSize: 16 },
  disabled:        { opacity: 0.5 },
});
