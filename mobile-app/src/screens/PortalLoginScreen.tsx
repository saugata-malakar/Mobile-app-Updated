import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import {useNavigation} from '@react-navigation/native';
import type {AppRole, WorkerType} from '../types/app';
import {
  DEFAULT_EMULATOR_URL,
  DEFAULT_LAN_URL,
  DEFAULT_LOCALHOST_URL,
  getApiBaseUrl,
  initApiBaseUrl,
  resetApiBaseUrl,
  setApiBaseUrl,
} from '../config/api';
import {
  getHomeParamsForRole,
  getHomeRouteForRole,
  getSavedLoginCredentials,
  loginWithIdentifier,
  registerUserV4,
} from '../services/authService';
import {pingServerHealth} from '../services/v4WorkflowService';
import {V4_COLORS} from '../theme/v4Theme';

export interface UserPersona {
  role: 'admin' | 'doctor' | 'data_collector' | 'patient' | 'field_worker' | 'moderator';
  name: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: string;
  mrnOrId: string;
  facility: string;
}

const ROLE_CARDS: Array<{
  role: AppRole;
  icon: string;
  title: string;
  badge: string;
  color: string;
  desc: string;
  demoId: string;
  demoPass: string;
}> = [
  {
    role: 'doctor',
    icon: '👨‍⚕️',
    title: 'Doctor',
    badge: '₹80 Direct · ₹30 Validate',
    color: '#2563EB',
    desc: 'Collect patient vitals, 3 wound photos, reports & clinical note (₹80) or validate ASHA records (₹30).',
    demoId: 'doctor@demo.in',
    demoPass: 'doctor123',
  },
  {
    role: 'field_worker',
    icon: '📋',
    title: 'ASHA / ICDS / CHO',
    badge: '₹50 Per Accepted Case',
    color: '#22C55E',
    desc: 'Field collector intake: patient details & 3 guided wound photos (no diagnosis required).',
    demoId: 'asha001',
    demoPass: 'asha123',
  },
  {
    role: 'moderator',
    icon: '🔍',
    title: 'Moderator',
    badge: '₹20 Per Approved Case',
    color: '#F59E0B',
    desc: 'Review AI-passed field collector records and approve or reject photo quality with reason.',
    demoId: 'mod001',
    demoPass: 'mod123',
  },
  {
    role: 'admin',
    icon: '⚙️',
    title: 'Admin',
    badge: 'Full System Access',
    color: '#8B5CF6',
    desc: 'All-access governance: verify new accounts, access every portal, inspect cases & ₹ payouts.',
    demoId: 'admin',
    demoPass: 'admin123',
  },
  {
    role: 'patient',
    icon: '🩹',
    title: 'Patient',
    badge: 'Patient Self-Care',
    color: '#10B981',
    desc: 'View diabetic foot screening journey, ulcer trajectory, clinical notes & follow-up alerts.',
    demoId: 'patient@demo.in',
    demoPass: 'patient123',
  },
];

const WORKER_TYPES: WorkerType[] = ['ASHA', 'ICDS', 'CHO'];

export default function PortalLoginScreen() {
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<AppRole>('doctor');

  // Login fields
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

  // Server URL & Status
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(getApiBaseUrl());
  const [busy, setBusy] = useState(false);
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<{
    name: string;
    role: string;
    message: string;
  } | null>(null);

  const checkHealth = useCallback(async (urlToTest?: string) => {
    const ok = await pingServerHealth(urlToTest);
    setServerOnline(ok);
    return ok;
  }, []);

  useEffect(() => {
    initApiBaseUrl().then(resolved => {
      setServerUrl(resolved);
      setCustomUrlInput(resolved);
      checkHealth(resolved);
    });
  }, [checkHealth]);

  useEffect(() => {
    getSavedLoginCredentials(selectedRole).then(saved => {
      setHasSavedCreds(Boolean(saved));
    });
  }, [selectedRole]);

  const handleLoadSaved = useCallback(async () => {
    const saved = await getSavedLoginCredentials(selectedRole);
    if (!saved) {
      Alert.alert('Saved Login', 'No saved credentials for this role yet.');
      return;
    }
    setIdentifier(saved.identifier);
    setPassword(saved.password);
  }, [selectedRole]);

  const handleLogin = useCallback(
    async (idOverride?: string, passOverride?: string, roleOverride?: AppRole) => {
      const id = (idOverride ?? identifier).trim();
      const pw = passOverride ?? password;
      const role = roleOverride ?? selectedRole;
      if (!id || !pw) {
        Alert.alert(
          'Credentials Required',
          'Enter Email, Phone, Username, or Worker ID and Password.',
        );
        return;
      }
      setBusy(true);
      try {
        const session = await loginWithIdentifier(id, pw, role);
        navigation.replace(
          getHomeRouteForRole(session.user.role),
          getHomeParamsForRole(session.user),
        );
      } catch (err: any) {
        Alert.alert(
          'Sign In Failed',
          `${err?.message || 'Unable to authenticate.'}\n\nServer: ${getApiBaseUrl()}`,
        );
      } finally {
        setBusy(false);
      }
    },
    [identifier, password, selectedRole, navigation],
  );

  const handleRegister = useCallback(async () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Name Required', 'Enter your full name.');
      return;
    }
    if (!email.trim() && !phone.trim() && !usernameOrWorkerId.trim()) {
      Alert.alert(
        'Identifier Required',
        'Provide at least one: Email, Phone Number, or Username / Worker ID.',
      );
      return;
    }
    if (password.length < 4) {
      Alert.alert('Password Required', 'Password must be at least 4 characters.');
      return;
    }

    setBusy(true);
    setPendingNotice(null);
    try {
      const result = await registerUserV4({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        username: usernameOrWorkerId.trim() || undefined,
        workerId: usernameOrWorkerId.trim() || undefined,
        password,
        role: selectedRole,
        workerType: selectedRole === 'field_worker' ? workerType : undefined,
        district:
          selectedRole === 'field_worker'
            ? district.trim() || undefined
            : undefined,
        specialization:
          selectedRole === 'doctor'
            ? specialization.trim() || undefined
            : undefined,
      });

      if (result.pendingApproval || !result.session) {
        const msg =
          result.message ||
          'Every new account must be verified & approved by an Administrator before signing in.';
        setPendingNotice({
          name: result.user.fullName || fullName.trim(),
          role: selectedRole.replace('_', ' '),
          message: msg,
        });
        setPassword('');
        Alert.alert('Pending Admin Verification', msg);
        return;
      }

      navigation.replace(
        getHomeRouteForRole(result.session.user.role),
        getHomeParamsForRole(result.session.user),
      );
    } catch (err: any) {
      Alert.alert(
        'Registration Failed',
        `${err?.message || 'Could not register account.'}\n\nServer: ${getApiBaseUrl()}`,
      );
    } finally {
      setBusy(false);
    }
  }, [
    fullName,
    email,
    phone,
    usernameOrWorkerId,
    password,
    selectedRole,
    workerType,
    district,
    specialization,
    navigation,
  ]);

  const applyServerUrl = async (url: string) => {
    const updated = await setApiBaseUrl(url);
    setServerUrl(updated);
    setCustomUrlInput(updated);
    const ok = await checkHealth(updated);
    setSettingsOpen(false);
    Alert.alert(
      'Server URL Updated',
      `${updated}\nStatus: ${ok ? 'Connected ✓' : 'Unreachable (check backend)'}`,
    );
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.logoDot} />
              <Text style={styles.appTitle}>DiabetesCare AI</Text>
              <View style={styles.versionPill}>
                <Text style={styles.versionText}>v4.0</Text>
              </View>
            </View>
            <Text style={styles.institution}>
              IIT Kharagpur & MMCH · Multi-Role Clinical Platform
            </Text>
          </View>

          {/* Server Status + Settings Trigger */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.statusBanner}
            onPress={() => setSettingsOpen(true)}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    serverOnline === true
                      ? V4_COLORS.success
                      : serverOnline === false
                      ? V4_COLORS.danger
                      : V4_COLORS.warning,
                },
              ]}
            />
            <Text style={styles.statusText} numberOfLines={1}>
              {serverOnline === true
                ? `Connected: ${serverUrl}`
                : serverOnline === false
                ? `Offline / Unreachable: ${serverUrl}`
                : `Checking: ${serverUrl}`}
            </Text>
            <Text style={styles.settingsLink}>Configure</Text>
          </TouchableOpacity>

          {/* 4 Role Selection Cards */}
          <Text style={styles.sectionLabel}>1. SELECT ROLE</Text>
          <View style={styles.roleGrid}>
            {ROLE_CARDS.map(card => {
              const active = selectedRole === card.role;
              return (
                <TouchableOpacity
                  key={card.role}
                  activeOpacity={0.88}
                  style={[
                    styles.roleCard,
                    active && {
                      borderColor: card.color,
                      backgroundColor: `${card.color}22`,
                    },
                  ]}
                  onPress={() => setSelectedRole(card.role)}>
                  <View style={styles.roleTop}>
                    <Text style={styles.roleIcon}>{card.icon}</Text>
                    <View
                      style={[
                        styles.roleBadge,
                        {backgroundColor: `${card.color}28`},
                      ]}>
                      <Text style={[styles.roleBadgeText, {color: card.color}]}>
                        {card.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.roleTitle}>{card.title}</Text>
                  <Text style={styles.roleDesc} numberOfLines={3}>
                    {card.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sign In / Register Toggle */}
          <Text style={styles.sectionLabel}>2. AUTHENTICATE</Text>
          <View style={styles.authCard}>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segBtn, mode === 'login' && styles.segActive]}
                onPress={() => {
                  setPendingNotice(null);
                  setMode('login');
                }}>
                <Text
                  style={[
                    styles.segText,
                    mode === 'login' && styles.segTextActive,
                  ]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, mode === 'register' && styles.segActive]}
                onPress={() => {
                  setPendingNotice(null);
                  setMode('register');
                }}>
                <Text
                  style={[
                    styles.segText,
                    mode === 'register' && styles.segTextActive,
                  ]}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {pendingNotice ? (
              <View style={styles.pendingBox}>
                <Text style={styles.pendingTitle}>
                  ⏳ Pending Admin Verification
                </Text>
                <Text style={styles.pendingText}>
                  {pendingNotice.name} ({pendingNotice.role}):{' '}
                  {pendingNotice.message}
                </Text>
                <TouchableOpacity
                  style={styles.pendingAdminBtn}
                  onPress={() => {
                    setSelectedRole('admin');
                    setMode('login');
                    setIdentifier('admin');
                    setPassword('admin123');
                  }}>
                  <Text style={styles.pendingAdminBtnText}>
                    Sign In as Admin to Verify →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {mode === 'login' ? (
              <>
                {hasSavedCreds && (
                  <TouchableOpacity
                    style={styles.savedBtn}
                    onPress={handleLoadSaved}>
                    <Text style={styles.savedBtnText}>
                      ⚡ Fill Saved Credentials ({selectedRole})
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.label}>
                  Email, Phone Number, Username, or Worker ID
                </Text>
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  placeholder="doctor@demo.in / 9831000001 / asha001"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />

                <Text style={[styles.label, {marginTop: 12}]}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password"
                    placeholderTextColor="rgba(148,163,184,0.75)"
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

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={busy}
                  style={[styles.primaryBtn, busy && {opacity: 0.6}]}
                  onPress={() => handleLogin()}>
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Sign In as{' '}
                      {ROLE_CARDS.find(r => r.role === selectedRole)?.title}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full name"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />

                <Text style={[styles.label, {marginTop: 10}]}>Email (Optional)</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@hospital.in"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />

                <Text style={[styles.label, {marginTop: 10}]}>
                  Phone Number (Optional)
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="10-digit mobile"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />

                <Text style={[styles.label, {marginTop: 10}]}>
                  Username / Worker ID
                </Text>
                <TextInput
                  value={usernameOrWorkerId}
                  onChangeText={setUsernameOrWorkerId}
                  autoCapitalize="none"
                  placeholder="e.g. DOC_02 or asha002"
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.input}
                />

                {selectedRole === 'field_worker' && (
                  <>
                    <Text style={[styles.label, {marginTop: 10}]}>
                      Field Collector Type *
                    </Text>
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

                    <Text style={[styles.label, {marginTop: 10}]}>District</Text>
                    <TextInput
                      value={district}
                      onChangeText={setDistrict}
                      placeholder="e.g. Paschim Medinipur"
                      placeholderTextColor="rgba(148,163,184,0.75)"
                      style={styles.input}
                    />
                  </>
                )}

                {selectedRole === 'doctor' && (
                  <>
                    <Text style={[styles.label, {marginTop: 10}]}>
                      Specialization / Reg No (Optional)
                    </Text>
                    <TextInput
                      value={specialization}
                      onChangeText={setSpecialization}
                      placeholder="e.g. Diabetologist · WBMC-12345"
                      placeholderTextColor="rgba(148,163,184,0.75)"
                      style={styles.input}
                    />
                  </>
                )}

                <Text style={[styles.label, {marginTop: 10}]}>Password *</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Min 4 characters"
                    placeholderTextColor="rgba(148,163,184,0.75)"
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

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={busy}
                  style={[
                    styles.primaryBtn,
                    {backgroundColor: V4_COLORS.success},
                    busy && {opacity: 0.6},
                  ]}
                  onPress={handleRegister}>
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Submit {ROLE_CARDS.find(r => r.role === selectedRole)?.title}{' '}
                      (Requires Admin Verify)
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* One-Click Demo Sign-In */}
          <Text style={[styles.sectionLabel, {marginTop: 18}]}>
            QUICK DEMO ONE-CLICK SIGN IN
          </Text>
          <View style={styles.demoGrid}>
            {ROLE_CARDS.map(card => (
              <TouchableOpacity
                key={`demo_${card.role}`}
                disabled={busy}
                style={[styles.demoBtn, {borderColor: `${card.color}66`}]}
                onPress={() => {
                  setSelectedRole(card.role);
                  setIdentifier(card.demoId);
                  setPassword(card.demoPass);
                  handleLogin(card.demoId, card.demoPass, card.role);
                }}>
                <Text style={styles.demoIcon}>{card.icon}</Text>
                <Text style={styles.demoTitle}>{card.title}</Text>
                <Text style={styles.demoCred}>{card.demoId}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Classic Clinical Hub Shortcut */}
          <TouchableOpacity
            style={styles.classicBtn}
            onPress={() =>
              navigation.navigate('DoctorCommandHub', {userRole: 'doctor'})
            }>
            <Text style={styles.classicBtnText}>
              Open Classic Clinical Command Hub →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Server URL Configuration Modal */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend Server URL</Text>
            <Text style={styles.modalSub}>
              Choose a preset or enter your PC's FastAPI URL (port 8000).
            </Text>

            <View style={styles.presetList}>
              {[
                {label: 'Android Emulator', url: DEFAULT_EMULATOR_URL},
                {label: 'PC LAN Wi-Fi', url: DEFAULT_LAN_URL},
                {label: 'Localhost (adb reverse)', url: DEFAULT_LOCALHOST_URL},
              ].map(p => (
                <TouchableOpacity
                  key={p.url}
                  style={styles.presetBtn}
                  onPress={() => applyServerUrl(p.url)}>
                  <Text style={styles.presetLabel}>{p.label}</Text>
                  <Text style={styles.presetUrl}>{p.url}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Custom URL</Text>
            <TextInput
              value={customUrlInput}
              onChangeText={setCustomUrlInput}
              autoCapitalize="none"
              placeholder="http://192.168.1.10:8000"
              placeholderTextColor="rgba(148,163,184,0.75)"
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionBtn, {backgroundColor: '#334155'}]}
                onPress={async () => {
                  const def = await resetApiBaseUrl();
                  setServerUrl(def);
                  setCustomUrlInput(def);
                  checkHealth(def);
                  setSettingsOpen(false);
                }}>
                <Text style={styles.modalActionText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, {backgroundColor: '#1E293B'}]}
                onPress={() => setSettingsOpen(false)}>
                <Text style={styles.modalActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalActionBtn,
                  {backgroundColor: V4_COLORS.primary},
                ]}
                onPress={() => applyServerUrl(customUrlInput)}>
                <Text style={styles.modalActionText}>Save & Test</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: V4_COLORS.bg},
  scroll: {padding: 16, paddingBottom: 40},
  header: {alignItems: 'center', marginBottom: 12},
  logoRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: V4_COLORS.primary,
  },
  appTitle: {fontSize: 23, fontWeight: '900', color: V4_COLORS.text},
  versionPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  versionText: {color: '#93C5FD', fontSize: 11, fontWeight: '800'},
  institution: {fontSize: 12, color: V4_COLORS.mutedText, marginTop: 4},
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: V4_COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
    gap: 8,
  },
  statusDot: {width: 9, height: 9, borderRadius: 5},
  statusText: {flex: 1, color: '#CBD5E1', fontSize: 12, fontWeight: '600'},
  settingsLink: {color: '#60A5FA', fontSize: 12, fontWeight: '800'},
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  roleCard: {
    width: '48.8%',
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: V4_COLORS.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  roleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleIcon: {fontSize: 22},
  roleBadge: {borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2},
  roleBadgeText: {fontSize: 9, fontWeight: '800'},
  roleTitle: {fontSize: 14, fontWeight: '900', color: V4_COLORS.text},
  roleDesc: {
    marginTop: 4,
    fontSize: 11,
    color: V4_COLORS.mutedText,
    lineHeight: 15,
  },
  authCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 18, 32, 0.7)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  segBtn: {flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8},
  segActive: {backgroundColor: V4_COLORS.primary},
  segText: {color: V4_COLORS.mutedText, fontWeight: '800', fontSize: 13},
  segTextActive: {color: '#FFFFFF'},
  savedBtn: {
    marginBottom: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    alignItems: 'center',
  },
  savedBtnText: {color: '#93C5FD', fontWeight: '800', fontSize: 12},
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: V4_COLORS.mutedText,
    marginBottom: 5,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: V4_COLORS.text,
    fontSize: 14,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
  },
  eyeBtn: {paddingHorizontal: 12, paddingVertical: 10},
  eyeText: {color: '#93C5FD', fontWeight: '700', fontSize: 12},
  chipRow: {flexDirection: 'row', gap: 8},
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.chipBg,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: V4_COLORS.success,
  },
  chipText: {color: V4_COLORS.mutedText, fontWeight: '800', fontSize: 12},
  chipTextActive: {color: '#FFFFFF'},
  primaryBtn: {
    marginTop: 16,
    backgroundColor: V4_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  demoBtn: {
    width: '48.5%',
    backgroundColor: V4_COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  demoIcon: {fontSize: 18, marginBottom: 2},
  demoTitle: {fontSize: 12, fontWeight: '800', color: V4_COLORS.text},
  demoCred: {fontSize: 11, color: V4_COLORS.mutedText, marginTop: 2},
  classicBtn: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    alignItems: 'center',
  },
  classicBtnText: {color: '#93C5FD', fontWeight: '800', fontSize: 13},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: V4_COLORS.cardSolid,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  modalTitle: {fontSize: 18, fontWeight: '900', color: V4_COLORS.text},
  modalSub: {
    fontSize: 12,
    color: V4_COLORS.mutedText,
    marginTop: 4,
    marginBottom: 12,
  },
  presetList: {gap: 8, marginBottom: 12},
  presetBtn: {
    backgroundColor: V4_COLORS.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 10,
  },
  presetLabel: {fontSize: 13, fontWeight: '800', color: V4_COLORS.text},
  presetUrl: {fontSize: 11, color: '#93C5FD', marginTop: 2},
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  modalActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalActionText: {color: '#FFFFFF', fontWeight: '800', fontSize: 13},
  pendingBox: {
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    padding: 12,
  },
  pendingTitle: {
    color: '#FDE68A',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 4,
  },
  pendingText: {
    color: '#FEF3C7',
    fontSize: 12,
    lineHeight: 17,
  },
  pendingAdminBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.6)',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  pendingAdminBtnText: {
    color: '#EDE9FE',
    fontWeight: '800',
    fontSize: 12,
  },
});
