import React, {useCallback, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';

import type {RootStackParamList} from '../navigation/RootNavigator';
import {api} from '../services/apiClient';
import {enqueueRequest} from '../services/offlineQueue';
import {getSession} from '../storage/appStorage';
import {setPatientOnboarding} from '../storage/onboardingStorage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MedicalHistorySetup'>;
type Rt = RouteProp<RootStackParamList, 'MedicalHistorySetup'>;

export default function MedicalHistorySetupScreen({navigation, route}: {navigation: Nav; route: Rt}) {
  const onboarding = route.params?.onboarding === true;
  const [diabetesType, setDiabetesType] = useState('');
  const [duration, setDuration] = useState('');
  const [hba1c, setHba1c] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const afterSave = useCallback(async () => {
    const session = await getSession();
    if (session?.role === 'patient') {
      await setPatientOnboarding(session.phone, {medicalHistoryDone: true});
    }
    if (onboarding) {
      navigation.replace('Consent', {onboarding: true});
      return;
    }
    navigation.goBack();
  }, [navigation, onboarding]);

  const submit = useCallback(async () => {
    setSaving(true);
    const body = {
      diabetes_type: diabetesType.trim() || undefined,
      diabetes_duration_years: duration ? Number(duration) : undefined,
      hba1c_value: hba1c ? Number(hba1c) : undefined,
      notes: notes.trim() || undefined,
    };
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await enqueueRequest('POST', '/api/v1/patients/me/medical-history', body);
        if (!onboarding) {
          Alert.alert('Queued', 'Medical history will upload when you are online.');
        }
        await afterSave();
        return;
      }
      await api.post('/api/v1/patients/me/medical-history', body);
      if (!onboarding) {
        Alert.alert('Saved', 'Medical history submitted.');
      }
      await afterSave();
    } catch {
      await enqueueRequest('POST', '/api/v1/patients/me/medical-history', body);
      if (!onboarding) {
        Alert.alert('Queued', 'Could not reach server — saved to offline queue.');
      }
      await afterSave();
    } finally {
      setSaving(false);
    }
  }, [afterSave, diabetesType, duration, hba1c, notes, onboarding]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Medical history (P5)</Text>
          <Text style={styles.sub}>
            {onboarding
              ? 'Step 2 of 3 — diabetes details help tailor wound monitoring.'
              : 'Update your diabetes and related history.'}
          </Text>

          <Field label="Diabetes type (e.g. TYPE2)" value={diabetesType} onChange={setDiabetesType} />
          <Field label="Duration (years)" value={duration} onChange={setDuration} keyboard="numeric" />
          <Field label="HbA1c (%)" value={hba1c} onChange={setHba1c} keyboard="decimal-pad" />
          <Field label="Notes" value={notes} onChange={setNotes} multiline />

          <TouchableOpacity
            style={[styles.primary, saving && styles.disabled]}
            disabled={saving}
            onPress={submit}>
            <Text style={styles.primaryText}>
              {saving ? 'Saving…' : onboarding ? 'Continue' : 'Save'}
            </Text>
          </TouchableOpacity>

          {!onboarding ? (
            <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  multiline?: boolean;
  keyboard?: 'default' | 'numeric' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.lab}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboard}
        placeholderTextColor="rgba(148,163,184,0.85)"
        style={[styles.input, multiline && {minHeight: 80, textAlignVertical: 'top'}]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  sub: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 13,
    color: 'rgba(248,250,252,0.72)',
    lineHeight: 18,
  },
  field: {marginBottom: 12},
  lab: {color: 'rgba(248,250,252,0.72)', fontWeight: '700', marginBottom: 6, fontSize: 12},
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  primary: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: {opacity: 0.65},
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  secondary: {marginTop: 12, paddingVertical: 14, alignItems: 'center'},
  secondaryText: {color: '#93C5FD', fontWeight: '800'},
});
