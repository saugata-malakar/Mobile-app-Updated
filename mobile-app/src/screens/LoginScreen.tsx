import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import type {AppRole, WorkerType} from '../types/app';
import {
  getHomeRouteForRole,
  getSavedLoginCredentials,
  loginWithIdentifier,
  registerUserV4,
} from '../services/authService';
import {initApiBaseUrl} from '../config/api';
import {V4_COLORS} from '../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'Login'>;
};

const WORKER_TYPES: WorkerType[] = ['ASHA', 'ICDS', 'CHO'];

export default function LoginScreen({navigation, route}: Props) {
  const rawRole = (route.params as any)?.role || 'doctor';
  const role: AppRole =
    rawRole === 'asha' ? 'field_worker' : (rawRole as AppRole);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [usernameOrWorkerId, setUsernameOrWorkerId] = useState('');
  const [workerType, setWorkerType] = useState<WorkerType>('ASHA');
  const [district, setDistrict] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    initApiBaseUrl();
    getSavedLoginCredentials(role).then(saved => {
      if (saved) {
        setHasSaved(true);
      }
    });
  }, [role]);

  const title = useMemo(() => {
    switch (role) {
      case 'doctor':
        return mode === 'login' ? 'Doctor Sign In' : 'Doctor Registration';
      case 'field_worker':
        return mode === 'login'
          ? 'Field Worker Sign In'
          : 'Field Worker Registration';
      case 'moderator':
        return mode === 'login' ? 'Moderator Sign In' : 'Moderator Registration';
      case 'admin':
        return mode === 'login' ? 'Admin Sign In' : 'Admin Registration';
    }
  }, [role, mode]);

  const loadSaved = useCallback(async () => {
    const saved = await getSavedLoginCredentials(role);
    if (!saved) {
      Alert.alert('Saved Login', 'No saved credentials found for this role.');
      return;
    }
    setIdentifier(saved.identifier);
    setPassword(saved.password);
  }, [role]);

  const handleSubmit = useCallback(async () => {
    if (mode === 'login') {
      if (!identifier.trim() || !password) {
        Alert.alert(
          'Missing Details',
          'Enter your email, phone, username, or worker ID and password.',
        );
        return;
      }
      setBusy(true);
      try {
        const session = await loginWithIdentifier(identifier.trim(), password, role);
        const target = getHomeRouteForRole(session.user.role);
        navigation.replace(target);
      } catch (e: any) {
        Alert.alert('Sign In Failed', e?.message || 'Invalid credentials.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (fullName.trim().length < 2) {
      Alert.alert('Full Name Required', 'Please enter your full name.');
      return;
    }
    if (!email.trim() && !phone.trim() && !usernameOrWorkerId.trim()) {
      Alert.alert(
        'Identifier Required',
        'Provide at least one of Email, Phone Number, or Username / Worker ID.',
      );
      return;
    }
    if (password.length < 4) {
      Alert.alert('Password Too Short', 'Password must be at least 4 characters.');
      return;
    }

    setBusy(true);
    try {
      const session = await registerUserV4({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        username: usernameOrWorkerId.trim() || undefined,
        workerId: usernameOrWorkerId.trim() || undefined,
        password,
        role,
        workerType: role === 'field_worker' ? workerType : undefined,
        district: role === 'field_worker' ? district.trim() || undefined : undefined,
        specialization:
          role === 'doctor' ? specialization.trim() || undefined : undefined,
      });
      const target = getHomeRouteForRole(session.user.role);
      navigation.replace(target);
    } catch (e: any) {
      Alert.alert('Registration Failed', e?.message || 'Could not create account.');
    } finally {
      setBusy(false);
    }
  }, [
    mode,
    identifier,
    password,
    role,
    fullName,
    email,
    phone,
    usernameOrWorkerId,
    workerType,
    district,
    specialization,
    navigation,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            Sign in with your Email, Phone Number, Username, or Worker ID.
          </Text>

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

          {mode === 'login' && hasSaved && (
            <TouchableOpacity style={styles.savedBtn} onPress={loadSaved}>
              <Text style={styles.savedBtnText}>Fill Saved Login Credentials</Text>
            </TouchableOpacity>
          )}

          {mode === 'register' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter full name"
                  placeholderTextColor="rgba(148,163,184,0.8)"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email (Optional)</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@hospital.in"
                  placeholderTextColor="rgba(148,163,184,0.8)"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Phone Number (Optional)</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="10-digit mobile"
                  placeholderTextColor="rgba(148,163,184,0.8)"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Username / Worker ID</Text>
                <TextInput
                  value={usernameOrWorkerId}
                  onChangeText={setUsernameOrWorkerId}
                  autoCapitalize="none"
                  placeholder="e.g. DOC_01 or asha001"
                  placeholderTextColor="rgba(148,163,184,0.8)"
                  style={styles.input}
                />
              </View>

              {role === 'field_worker' && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Worker Type *</Text>
                    <View style={styles.chipRow}>
                      {WORKER_TYPES.map(wt => {
                        const active = workerType === wt;
                        return (
                          <TouchableOpacity
                            key={wt}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => setWorkerType(wt)}>
                            <Text
                              style={[
                                styles.chipText,
                                active && styles.chipTextActive,
                              ]}>
                              {wt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>District</Text>
                    <TextInput
                      value={district}
                      onChangeText={setDistrict}
                      placeholder="e.g. Paschim Medinipur"
                      placeholderTextColor="rgba(148,163,184,0.8)"
                      style={styles.input}
                    />
                  </View>
                </>
              )}

              {role === 'doctor' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Specialization (Optional)</Text>
                  <TextInput
                    value={specialization}
                    onChangeText={setSpecialization}
                    placeholder="e.g. Diabetologist, Podiatric Surgeon"
                    placeholderTextColor="rgba(148,163,184,0.8)"
                    style={styles.input}
                  />
                </View>
              )}
            </>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>
                Email / Phone / Username / Worker ID
              </Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                placeholder="e.g. doctor@demo.in or asha001 or 9831000001"
                placeholderTextColor="rgba(148,163,184,0.8)"
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter password"
                placeholderTextColor="rgba(148,163,184,0.8)"
                style={[styles.input, {flex: 1, borderWidth: 0}]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                style={styles.eyeBtn}>
                <Text style={styles.eyeText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={busy}
            onPress={handleSubmit}
            style={[styles.primary, busy && styles.primaryDisabled]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                {mode === 'register' ? 'Create Account & Sign In' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.replace('RoleSelect')}
            style={styles.link}>
            <Text style={styles.linkText}>← Choose Different Role</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: V4_COLORS.bg},
  scroll: {padding: 22, paddingBottom: 40},
  title: {fontSize: 26, fontWeight: '900', color: V4_COLORS.text},
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: V4_COLORS.mutedText,
    lineHeight: 20,
    marginBottom: 16,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  segBtn: {flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11},
  segActive: {backgroundColor: V4_COLORS.primary},
  segText: {color: V4_COLORS.mutedText, fontWeight: '800'},
  segTextActive: {color: '#FFFFFF'},
  savedBtn: {
    marginBottom: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center',
  },
  savedBtnText: {color: '#93C5FD', fontWeight: '800', fontSize: 13},
  field: {marginBottom: 12},
  label: {
    color: V4_COLORS.mutedText,
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: V4_COLORS.text,
    backgroundColor: V4_COLORS.inputBg,
    fontSize: 15,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
  },
  eyeBtn: {paddingHorizontal: 14, paddingVertical: 12},
  eyeText: {color: '#93C5FD', fontWeight: '700', fontSize: 13},
  chipRow: {flexDirection: 'row', gap: 10},
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.chipBg,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: V4_COLORS.primary,
  },
  chipText: {color: V4_COLORS.mutedText, fontWeight: '800'},
  chipTextActive: {color: '#FFFFFF'},
  primary: {
    marginTop: 14,
    backgroundColor: V4_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryDisabled: {opacity: 0.6},
  primaryText: {color: '#FFFFFF', fontWeight: '900', fontSize: 16},
  link: {marginTop: 18, alignItems: 'center'},
  linkText: {color: '#93C5FD', fontWeight: '800', fontSize: 14},
});
