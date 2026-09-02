import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {downloadReferralPdfToCache, shareReferralPdfFile} from '../services/ashaReferralService';
import {getAshaPatient, getSession} from '../storage/appStorage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaReferralForm'>;
type Rt = RouteProp<RootStackParamList, 'AshaReferralForm'>;

export default function AshaReferralForm({navigation, route}: {navigation: Nav; route: Rt}) {
  const p = route.params;
  const [patientName, setPatientName] = useState(p.patientName ?? '');
  const [age, setAge] = useState(p.patientAge != null ? String(p.patientAge) : '');
  const [village, setVillage] = useState(p.village ?? '');
  const [phone, setPhone] = useState(p.phone ?? '');
  const [diagnosisCode, setDiagnosisCode] = useState(p.diagnosisCode ?? '');
  const [diagnosisDescription, setDiagnosisDescription] = useState(
    p.diagnosisDescription ?? p.conditions?.[0] ?? '',
  );
  const [specialist, setSpecialist] = useState(p.specialist ?? 'Physician / surgeon at PHC');
  const [urgency, setUrgency] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY'>(p.urgency ?? 'URGENT');
  const [ashaName, setAshaName] = useState('');
  const [ashaId, setAshaId] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  const referralDate = useMemo(
    () => new Date().toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'}),
    [],
  );

  const loadLocal = useCallback(async () => {
    const s = await getSession();
    if (s?.role === 'asha') {
      setAshaName(s.displayName ?? '');
      setAshaId(prev => prev || s.phone);
      const prof = await getAshaPatient(s.phone, p.patientId);
      if (prof) {
        setPatientName(prev => prev || prof.fullName);
        setVillage(prev => prev || prof.village);
        setPhone(prev => prev || prof.phone);
        setAge(prev => prev || String(prof.age ?? ''));
      }
    }
  }, [p.patientId]);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  const buildPayload = () => ({
    patient_id: p.patientId,
    patient_name: patientName.trim() || 'Unknown',
    patient_age: age ? Number(age) : undefined,
    village: village.trim() || undefined,
    phone: phone.trim() || undefined,
    risk_level: p.riskLevel,
    conditions: p.conditions ?? [],
    recommendation: p.recommendation,
    diagnosis_code: diagnosisCode.trim() || undefined,
    diagnosis_description: diagnosisDescription.trim() || undefined,
    specialist: specialist.trim() || undefined,
    urgency,
    asha_worker_name: ashaName.trim() || undefined,
    asha_id_number: ashaId.trim() || undefined,
  });

  const formattedText = useMemo(() => {
    const primary = p.conditions?.[0] ?? diagnosisDescription;
    const rec = p.recommendation ?? diagnosisDescription;
    return [
      'PHC REFERRAL SLIP (HealthScreen)',
      '────────────────────────',
      `Date: ${referralDate}`,
      '',
      'PATIENT',
      `Name: ${patientName || '—'}`,
      `Age: ${age || '—'}`,
      `Village: ${village || '—'}`,
      `Phone: ${phone || '—'}`,
      '',
      'CLINICAL',
      `AI risk level: ${p.riskLevel.toUpperCase()}`,
      `Primary finding: ${primary || '—'}`,
      `Recommended action: ${rec || '—'}`,
      `Specialist: ${specialist}`,
      `Urgency: ${urgency}`,
      diagnosisCode ? `Diagnosis code: ${diagnosisCode}` : '',
      diagnosisDescription ? `Notes: ${diagnosisDescription}` : '',
      '',
      'ASHA WORKER',
      `Name: ${ashaName || '—'}`,
      `NHM ID: ${ashaId || '—'}`,
      '',
      'Generated via HealthScreen ASHA app. Server PDF available in a later release.',
    ]
      .filter(Boolean)
      .join('\n');
  }, [
    age,
    ashaId,
    ashaName,
    diagnosisCode,
    diagnosisDescription,
    p.conditions,
    p.recommendation,
    p.riskLevel,
    patientName,
    phone,
    referralDate,
    specialist,
    urgency,
    village,
  ]);

  const onShareText = async () => {
    try {
      await Share.share({message: formattedText, title: 'PHC referral slip'});
    } catch (e) {
      Alert.alert('Share failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const onGeneratePdf = async () => {
    setBusy(true);
    setPdfPath(null);
    try {
      const path = await downloadReferralPdfToCache(buildPayload());
      setPdfPath(path);
      Alert.alert('Referral slip', 'PDF saved. You can share the file below.');
    } catch (e) {
      Alert.alert('PDF failed', e instanceof Error ? e.message : 'Could not reach server');
    } finally {
      setBusy(false);
    }
  };

  const onSharePdf = async () => {
    if (!pdfPath) {
      Alert.alert('Generate first', 'Create the PDF before sharing the file.');
      return;
    }
    try {
      await shareReferralPdfFile(pdfPath, 'PHC referral slip');
    } catch (e) {
      Alert.alert('Share failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Referral slip (A17)</Text>
        <View style={{width: 72}} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          Auto-filled from screening result. Share as text now; PDF is optional (server).
        </Text>

        <Field label="Patient name" value={patientName} onChangeText={setPatientName} />
        <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Field label="Village" value={village} onChangeText={setVillage} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Diagnosis code (optional)" value={diagnosisCode} onChangeText={setDiagnosisCode} />
        <Field
          label="Primary finding / clinical note"
          value={diagnosisDescription}
          onChangeText={setDiagnosisDescription}
          multiline
        />
        <Field label="Recommended specialist" value={specialist} onChangeText={setSpecialist} />
        <Text style={styles.lbl}>Urgency</Text>
        <View style={styles.row}>
          {(['ROUTINE', 'URGENT', 'EMERGENCY'] as const).map(u => (
            <TouchableOpacity
              key={u}
              style={[styles.chip, urgency === u && styles.chipOn]}
              onPress={() => setUrgency(u)}>
              <Text style={[styles.chipText, urgency === u && styles.chipTextOn]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="ASHA name" value={ashaName} onChangeText={setAshaName} />
        <Field label="ASHA NHM ID" value={ashaId} onChangeText={setAshaId} />
        <Text style={styles.aiMeta}>
          Date: {referralDate} · AI risk: {p.riskLevel.toUpperCase()}
        </Text>

        <TouchableOpacity style={styles.primary} onPress={onShareText}>
          <Text style={styles.primaryText}>Share referral (text)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondary} disabled={busy} onPress={onGeneratePdf}>
          {busy ? (
            <ActivityIndicator color="#86EFAC" />
          ) : (
            <Text style={styles.secondaryText}>Generate PDF (optional)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondary, !pdfPath && styles.secondaryOff]}
          disabled={!pdfPath}
          onPress={onSharePdf}>
          <Text style={styles.secondaryText}>Share PDF file</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
}) {
  return (
    <View style={{marginBottom: 12}}>
      <Text style={styles.lbl}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, multiline && {minHeight: 72, textAlignVertical: 'top'}]}
        placeholderTextColor="rgba(148,163,184,0.65)"
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  back: {paddingVertical: 6, paddingRight: 8},
  backText: {color: '#93C5FD', fontWeight: '800'},
  title: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  scroll: {padding: 20, paddingBottom: 40},
  hint: {color: 'rgba(248,250,252,0.65)', marginBottom: 14, lineHeight: 18},
  lbl: {color: 'rgba(248,250,252,0.75)', fontWeight: '700', marginBottom: 6, fontSize: 13},
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
  },
  chipOn: {backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.55)'},
  chipText: {color: 'rgba(248,250,252,0.8)', fontWeight: '700', fontSize: 12},
  chipTextOn: {color: '#FEE2E2'},
  aiMeta: {color: 'rgba(148,163,184,0.95)', marginBottom: 14, lineHeight: 18},
  primary: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
    marginBottom: 10,
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 15},
  secondary: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    marginBottom: 10,
  },
  secondaryOff: {opacity: 0.4},
  secondaryText: {color: '#93C5FD', fontWeight: '800'},
});
