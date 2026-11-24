import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {
  AppRole,
  CapturedPhoto,
  ClinicalNoteDraft,
  MedicalReportFile,
  PatientDetailsDraft,
} from '../../types/app';
import {
  addClinicalNote,
  validateDoctorSubmission,
} from '../../services/v4WorkflowService';
import {V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'ClinicalNote'>;
};

const HELPER_CHIPS = [
  'Wound healing',
  'Infection present',
  'Refer to specialist',
  'Continue current treatment',
];

const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'];

export default function ClinicalNoteScreen({navigation, route}: Props) {
  const params = (route.params || {}) as {
    mode?: 'own' | 'validate';
    role?: AppRole;
    submissionId: string;
    patientId?: string;
    patientDetails?: PatientDetailsDraft;
    photos?: CapturedPhoto[];
    reports?: MedicalReportFile[];
  };

  const mode = params.mode || 'own';
  const [noteText, setNoteText] = useState('');
  const [severity, setSeverity] = useState('Moderate');
  const [treatmentNeeded, setTreatmentNeeded] = useState('');
  const [medication, setMedication] = useState('');
  const [busy, setBusy] = useState(false);

  const appendChip = (chip: string) => {
    setNoteText(prev => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return chip;
      }
      if (trimmed.toLowerCase().includes(chip.toLowerCase())) {
        return prev;
      }
      return `${trimmed}. ${chip}`;
    });
  };

  const trimmedLength = noteText.trim().length;
  const isValid = trimmedLength >= 10;

  const handleContinue = async () => {
    if (!isValid) {
      Alert.alert(
        'Clinical Note Required',
        'Please write at least 10 characters covering diagnosis, severity, treatment, and medication.',
      );
      return;
    }

    const draft: ClinicalNoteDraft = {
      diagnosis: noteText.trim(),
      severity,
      treatmentNeeded: treatmentNeeded.trim() || undefined,
      medication: medication.trim() || undefined,
    };

    setBusy(true);
    try {
      if (mode === 'validate') {
        await validateDoctorSubmission(params.submissionId, draft);
        Alert.alert(
          'Validation Complete ✓',
          'Clinical note saved! ₹30 credited to your doctor account and ₹50 credited to the field worker.',
          [{text: 'OK', onPress: () => navigation.goBack()}],
        );
        return;
      }

      await addClinicalNote(params.submissionId, draft);
      navigation.navigate('ReviewAndSubmit', {
        role: params.role || 'doctor',
        submissionId: params.submissionId,
        patientId: params.patientId,
        patientDetails: params.patientDetails,
        photos: params.photos || [],
        reports: params.reports || [],
        clinicalNote: draft,
      });
    } catch (err: any) {
      Alert.alert(
        'Error Saving Note',
        err?.message || 'Could not save clinical note.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.stepPill}>
              {mode === 'validate' ? 'ASHA Validation (₹30)' : 'Step 4 · Doctor Note'}
            </Text>
          </View>

          <Text style={styles.title}>Clinical Note</Text>
          <Text style={styles.sub}>
            Write your diagnosis, severity assessment, treatment needed, and
            medication (1–2 lines)
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>
              Clinical Assessment * ({trimmedLength}/10 min chars)
            </Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="Write your diagnosis, severity assessment, treatment needed, and medication (1–2 lines)"
              placeholderTextColor="rgba(148,163,184,0.75)"
              style={styles.textArea}
            />

            <Text style={[styles.label, {marginTop: 12}]}>
              Quick Helper Chips (tap to append)
            </Text>
            <View style={styles.chipsWrap}>
              {HELPER_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip}
                  style={styles.helperChip}
                  onPress={() => appendChip(chip)}>
                  <Text style={styles.helperChipText}>+ {chip}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, {marginTop: 14}]}>Severity</Text>
            <View style={styles.sevRow}>
              {SEVERITY_OPTIONS.map(opt => {
                const active = severity === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.sevBtn, active && styles.sevBtnActive]}
                    onPress={() => setSeverity(opt)}>
                    <Text
                      style={[
                        styles.sevText,
                        active && styles.sevTextActive,
                      ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, {marginTop: 12}]}>
              Treatment Needed (Optional)
            </Text>
            <TextInput
              value={treatmentNeeded}
              onChangeText={setTreatmentNeeded}
              placeholder="e.g. Saline debridement, offloading footwear"
              placeholderTextColor="rgba(148,163,184,0.75)"
              style={styles.input}
            />

            <Text style={[styles.label, {marginTop: 12}]}>
              Medication (Optional)
            </Text>
            <TextInput
              value={medication}
              onChangeText={setMedication}
              placeholder="e.g. Amoxicillin-Clavulanate 625mg BD × 7d"
              placeholderTextColor="rgba(148,163,184,0.75)"
              style={styles.input}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!isValid || busy}
            style={[
              styles.nextBtn,
              (!isValid || busy) && styles.nextDisabled,
            ]}
            onPress={handleContinue}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.nextText}>
                {mode === 'validate'
                  ? 'Submit Validation & Credit ₹30 ✓'
                  : 'Next: Review & Submit →'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: V4_COLORS.bg},
  scroll: {padding: 18, paddingBottom: 40},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {color: '#93C5FD', fontSize: 15, fontWeight: '800'},
  stepPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    color: '#93C5FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {fontSize: 24, fontWeight: '900', color: V4_COLORS.text},
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: V4_COLORS.mutedText,
    marginBottom: 16,
    lineHeight: 19,
  },
  card: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 16,
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: V4_COLORS.mutedText,
    marginBottom: 6,
  },
  textArea: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
    padding: 12,
    color: V4_COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  helperChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  helperChipText: {color: '#93C5FD', fontSize: 12, fontWeight: '800'},
  sevRow: {flexDirection: 'row', gap: 8},
  sevBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.chipBg,
    alignItems: 'center',
  },
  sevBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: V4_COLORS.primary,
  },
  sevText: {color: V4_COLORS.mutedText, fontWeight: '800', fontSize: 13},
  sevTextActive: {color: '#FFFFFF'},
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: V4_COLORS.text,
    fontSize: 14,
  },
  nextBtn: {
    backgroundColor: V4_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextDisabled: {opacity: 0.45},
  nextText: {color: '#FFFFFF', fontWeight: '900', fontSize: 16},
});
