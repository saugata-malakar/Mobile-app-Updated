import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import * as Keychain from 'react-native-keychain';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import ReactNativeBiometrics from 'react-native-biometrics';
import type {RootStackParamList} from '../navigation/RootNavigator';
import type {AppRole} from '../types/app';
import {
  ensureDemoAshaAccounts,
  getPatientSelfProfile,
  loginAccount,
  normalizePhone,
  registerAccount,
  setSession,
} from '../storage/appStorage';
import {
  loginAshaWithServer,
  loginWithServer,
  registerWithServer,
} from '../services/authService';
import {isAshaTrainingComplete} from '../storage/ashaTrainingStorage';
import {isPatientOnboardingComplete} from '../storage/onboardingStorage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
  route: RouteProp<RootStackParamList, 'Login'>;
};

const bioService = (role: AppRole) => `healthscreen_login_${role}`;
const rnBiometrics = new ReactNativeBiometrics();

const DEMO_ASHA_WORKER_ID = 'asha001';
const DEMO_ASHA_PIN = '1234';

export default function LoginScreen({navigation, route}: Props) {
  const role: AppRole = route.params.role;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState(role === 'asha' ? DEMO_ASHA_WORKER_ID : '');
  const [pin, setPin] = useState(role === 'asha' ? DEMO_ASHA_PIN : '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const title = useMemo(
    () =>
      role === 'asha'
        ? 'ASHA worker sign-in'
        : 'Patient sign-in',
    [role],
  );

  const tryBiometricFill = useCallback(async () => {
    const {available} = await rnBiometrics.isSensorAvailable();
    if (!available) {
      Alert.alert('Biometrics', 'No fingerprint or Face ID is available on this device.');
      return;
    }
    const auth = await rnBiometrics.simplePrompt({promptMessage: 'Unlock HealthScreen'});
    if (!auth.success) {
      return;
    }
    try {
      const creds = await Keychain.getGenericPassword({
        service: bioService(role),
        authenticationPrompt: {title: 'Load saved login'},
      });
      if (creds) {
        setPhone(creds.username);
        setPin(creds.password ?? '');
      }
    } catch {
      // User cancelled keychain or nothing stored.
    }
  }, [role]);


  const submit = useCallback(async () => {
    const p =
      role === 'asha'
        ? phone.trim().toLowerCase()
        : normalizePhone(phone);
    if (role === 'asha') {
      if (p.length < 4 || pin.length < 4) {
        Alert.alert('Check details', 'Enter worker ID and at least a 4-digit PIN.');
        return;
      }
    } else if (p.length < 10 || pin.length < 4) {
      Alert.alert('Check details', 'Enter a valid phone and at least 4-digit PIN.');
      return;
    }
    if (mode === 'register' && name.trim().length < 2) {
      Alert.alert('Name required', 'Enter your full name to create an account.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await registerAccount(role, p, pin, name.trim());
        await registerWithServer(p, pin, name.trim(), role);
      } else if (role === 'asha') {
        await loginAshaWithServer(p, pin);
      } else {
        await loginWithServer(p, pin, role);
      }
      const session = await loginAccount(role, p, pin);
      await setSession(session);

      const {available} = await rnBiometrics.isSensorAvailable();
      if (available) {
        Alert.alert(
          'Biometrics',
          'Save this login for fingerprint / Face ID next time?',
          [
            {text: 'Not now', style: 'cancel'},
            {
              text: 'Save',
              onPress: () =>
                Keychain.setGenericPassword(p, pin, {
                  service: bioService(role),
                }),
            },
          ],
        );
      }

      if (role === 'patient') {
        const profile = await getPatientSelfProfile(session.phone);
        if (!profile) {
          navigation.replace('PatientRegistration', {flow: 'first_time'});
          return;
        }
        if (!(await isPatientOnboardingComplete(session.phone))) {
          navigation.replace('MedicalHistorySetup', {onboarding: true});
          return;
        }
        navigation.replace('PatientHome');
        return;
      }

      const trained = await isAshaTrainingComplete(session.phone);
      navigation.replace(trained ? 'AshaHome' : 'AshaTrainingHome');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Could not continue', msg);
    } finally {
      setBusy(false);
    }
  }, [mode, name, navigation, phone, pin, role]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            {role === 'asha'
              ? 'Use your worker ID and PIN. Demo login is pre-filled below.'
              : 'Use your mobile number. Registration is one-time per device.'}
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={tryBiometricFill}
            style={styles.bioBtn}>
            <Text style={styles.bioBtnText}>Use fingerprint / Face ID</Text>
          </TouchableOpacity>

          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segBtn, mode === 'login' && styles.segActive]}
              onPress={() => setMode('login')}>
              <Text
                style={[
                  styles.segText,
                  mode === 'login' && styles.segTextActive,
                ]}>
                Login
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, mode === 'register' && styles.segActive]}
              onPress={() => setMode('register')}>
              <Text
                style={[
                  styles.segText,
                  mode === 'register' && styles.segTextActive,
                ]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'register' && (
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="As on government ID"
                placeholderTextColor="rgba(148,163,184,0.9)"
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>
              {role === 'asha' ? 'Worker ID' : 'Mobile number'}
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              autoCapitalize={role === 'asha' ? 'none' : 'none'}
              keyboardType={role === 'asha' ? 'default' : 'phone-pad'}
              placeholder={role === 'asha' ? 'e.g. asha001' : '10-digit mobile'}
              placeholderTextColor="rgba(148,163,184,0.9)"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PIN</Text>
            <TextInput
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="Min 4 digits"
              placeholderTextColor="rgba(148,163,184,0.9)"
              style={styles.input}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={busy}
            onPress={submit}
            style={[styles.primary, busy && styles.primaryDisabled]}>
            <Text style={styles.primaryText}>
              {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.replace('RoleSelect')}
            style={styles.link}>
            <Text style={styles.linkText}>Choose different mode</Text>
          </TouchableOpacity>

          <Text style={styles.demoNote}>
            {role === 'asha'
              ? `Demo ASHA (pre-filled): ${DEMO_ASHA_WORKER_ID} · PIN ${DEMO_ASHA_PIN}. Also: asha002 / ${DEMO_ASHA_PIN}. Works offline on this device; with Flask on :5001, same IDs use the server.`
              : 'Demo: data stays on this device only (no cloud sync yet).'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 22, paddingBottom: 40},
  title: {fontSize: 26, fontWeight: '900', color: '#F8FAFC'},
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(248,250,252,0.72)',
    lineHeight: 20,
    marginBottom: 10,
  },
  bioBtn: {
    marginBottom: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center',
  },
  bioBtnText: {color: '#93C5FD', fontWeight: '900', fontSize: 14},
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  segBtn: {flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12},
  segActive: {backgroundColor: 'rgba(37,99,235,0.35)'},
  segText: {color: 'rgba(248,250,252,0.7)', fontWeight: '800'},
  segTextActive: {color: '#F8FAFC'},
  field: {marginBottom: 12},
  label: {
    color: 'rgba(248,250,252,0.72)',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 12,
  },
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
    marginTop: 10,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryDisabled: {opacity: 0.6},
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  link: {marginTop: 16, alignItems: 'center'},
  linkText: {color: '#93C5FD', fontWeight: '800'},
  demoNote: {
    marginTop: 22,
    fontSize: 12,
    color: 'rgba(148,163,184,0.85)',
    lineHeight: 17,
  },
});
