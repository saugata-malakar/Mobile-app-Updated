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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {AppRole, PatientDetailsDraft} from '../../types/app';
import {createSubmission} from '../../services/v4WorkflowService';
import {V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'PatientDetailsForm'>;
};

const COMORBIDITY_OPTIONS = [
  'Diabetes Type 1',
  'Diabetes Type 2',
  'Hypertension',
  'Heart Disease',
  'Kidney Disease',
  'Neuropathy',
  'Other',
];

export default function PatientDetailsForm({navigation, route}: Props) {
  const params = (route.params || {}) as {
    role?: AppRole;
    isFollowup?: boolean;
    patientId?: string;
  };
  const role: AppRole = params.role || 'field_worker';

  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [district, setDistrict] = useState('');
  const [comorbidities, setComorbidities] = useState<string[]>([
    'Diabetes Type 2',
  ]);
  const [isFollowup, setIsFollowup] = useState(Boolean(params.isFollowup));
  const [patientId, setPatientId] = useState(params.patientId || '');
  const [busy, setBusy] = useState(false);

  const toggleComorbidity = (item: string) => {
    setComorbidities(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item],
    );
  };

  const handleNext = async () => {
    const ageNum = parseInt(age.trim(), 10);
    const weightNum = parseFloat(weightKg.trim());
    const sysNum = parseInt(bpSystolic.trim(), 10);
    const diaNum = parseInt(bpDiastolic.trim(), 10);
    const sugarNum = parseFloat(bloodSugar.trim());

    if (!Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 120) {
      Alert.alert('Invalid Age', 'Enter a valid patient age (1–120 years).');
      return;
    }
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 300) {
      Alert.alert('Invalid Weight', 'Enter patient weight in kg.');
      return;
    }
    if (
      !Number.isFinite(sysNum) ||
      !Number.isFinite(diaNum) ||
      sysNum < 50 ||
      diaNum < 30
    ) {
      Alert.alert(
        'Invalid Blood Pressure',
        'Enter valid Systolic and Diastolic BP values.',
      );
      return;
    }
    if (!Number.isFinite(sugarNum) || sugarNum <= 0) {
      Alert.alert('Invalid Blood Sugar', 'Enter blood sugar in mg/dL.');
      return;
    }
    if (isFollowup && !patientId.trim()) {
      Alert.alert(
        'Patient ID Required',
        'Enter the existing Patient ID for a 1-month follow-up visit.',
      );
      return;
    }

    const details: PatientDetailsDraft = {
      patientName: patientName.trim() || 'Unnamed Patient',
      patientId: isFollowup ? patientId.trim() : undefined,
      age: ageNum,
      weightKg: weightNum,
      bpSystolic: sysNum,
      bpDiastolic: diaNum,
      bloodSugar: sugarNum,
      district: district.trim() || undefined,
      comorbidities,
      isFollowup,
    };

    setBusy(true);
    try {
      const sub = await createSubmission(details);
      navigation.navigate('ThreePhotoCapture', {
        role,
        submissionId: sub.submission_id,
        patientId: sub.patient_id,
        patientDetails: {
          ...details,
          patientId: sub.patient_id,
        },
      });
    } catch (err: any) {
      Alert.alert(
        'Could Not Save Patient Record',
        err?.message || 'Check your network connection and backend server.',
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
            <Text style={styles.stepPill}>Step 1 · Patient Vitals</Text>
          </View>

          <Text style={styles.title}>Patient Details</Text>
          <Text style={styles.sub}>
            Record clinical vitals and comorbidities before taking the 3 guided
            photos.
          </Text>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={{flex: 1}}>
                <Text style={styles.switchTitle}>Is Follow-up Visit?</Text>
                <Text style={styles.switchHint}>
                  Use the same Patient ID for 1-month follow-up tracking.
                </Text>
              </View>
              <Switch
                value={isFollowup}
                onValueChange={setIsFollowup}
                trackColor={{false: '#334155', true: V4_COLORS.primary}}
                thumbColor="#F8FAFC"
              />
            </View>

            {isFollowup && (
              <View style={styles.field}>
                <Text style={styles.label}>Existing Patient ID *</Text>
                <TextInput
                  value={patientId}
                  onChangeText={setPatientId}
                  autoCapitalize="characters"
                  placeholder="e.g. PAT_KGP_01 or PT-XXXX"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Patient Name</Text>
              <TextInput
                value={patientName}
                onChangeText={setPatientName}
                placeholder="Full name"
                placeholderTextColor="rgba(148,163,184,0.75)"
                style={styles.input}
              />
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.field, {flex: 1}]}>
                <Text style={styles.label}>Age (years) *</Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  placeholder="e.g. 56"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />
              </View>
              <View style={[styles.field, {flex: 1}]}>
                <Text style={styles.label}>Weight (kg) *</Text>
                <TextInput
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 68"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.field, {flex: 1}]}>
                <Text style={styles.label}>BP Systolic (mmHg) *</Text>
                <TextInput
                  value={bpSystolic}
                  onChangeText={setBpSystolic}
                  keyboardType="number-pad"
                  placeholder="130"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />
              </View>
              <View style={[styles.field, {flex: 1}]}>
                <Text style={styles.label}>BP Diastolic (mmHg) *</Text>
                <TextInput
                  value={bpDiastolic}
                  onChangeText={setBpDiastolic}
                  keyboardType="number-pad"
                  placeholder="84"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.field, {flex: 1}]}>
                <Text style={styles.label}>Blood Sugar (mg/dL) *</Text>
                <TextInput
                  value={bloodSugar}
                  onChangeText={setBloodSugar}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 185"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />
              </View>
              <View style={[styles.field, {flex: 1}]}>
                <Text style={styles.label}>District / Village</Text>
                <TextInput
                  value={district}
                  onChangeText={setDistrict}
                  placeholder="Optional"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />
              </View>
            </View>

            <Text style={[styles.label, {marginTop: 4}]}>Comorbidities</Text>
            <View style={styles.chipsWrap}>
              {COMORBIDITY_OPTIONS.map(item => {
                const selected = comorbidities.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleComorbidity(item)}>
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}>
                      {selected ? `✓ ${item}` : item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={busy}
            style={[styles.primaryBtn, busy && {opacity: 0.6}]}
            onPress={handleNext}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                Next: Capture 3 Photos →
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
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.15)',
    gap: 10,
  },
  switchTitle: {fontSize: 15, fontWeight: '800', color: V4_COLORS.text},
  switchHint: {fontSize: 12, color: V4_COLORS.mutedText, marginTop: 2},
  field: {marginBottom: 12},
  rowTwo: {flexDirection: 'row', gap: 10},
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: V4_COLORS.mutedText,
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: V4_COLORS.text,
    fontSize: 15,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.chipBg,
  },
  chipSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
    borderColor: V4_COLORS.primary,
  },
  chipText: {color: V4_COLORS.mutedText, fontSize: 12, fontWeight: '700'},
  chipTextSelected: {color: '#FFFFFF'},
  primaryBtn: {
    marginTop: 18,
    backgroundColor: V4_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 16},
});
