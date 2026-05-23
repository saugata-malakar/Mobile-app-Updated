import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
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
import type {RootStackParamList} from '../navigation/RootNavigator';
import type {Gender, PatientProfile} from '../types/app';
import {trySyncAshaPatientToServer} from '../services/patientRemoteSync';
import {
  getAshaPatient,
  getPatientSelfProfile,
  getSession,
  listAshaPatients,
  normalizePhone,
  savePatientSelfProfile,
  upsertAshaPatient,
} from '../storage/appStorage';
import {SCREENING_DISCLAIMER} from '../utils/openTelemedicine';
import {setPatientOnboarding} from '../storage/onboardingStorage';

type Props = {
  navigation: NativeStackNavigationProp<
    RootStackParamList,
    'PatientRegistration'
  >;
  route: RouteProp<RootStackParamList, 'PatientRegistration'>;
};

const emptyForm = () => ({
  fullName: '',
  age: '',
  gender: '' as Gender,
  phone: '',
  address: '',
  village: '',
  emergencyContact: '',
  bloodGroup: '',
  allergies: '',
  chronicConditions: '',
});

export default function PatientRegistrationScreen({navigation, route}: Props) {
  const flow = route.params?.flow ?? 'first_time';
  const editPatientId = route.params?.ashaPatientId;

  const isAshaPatientForm = flow === 'asha_new' || flow === 'asha_edit';

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const header = useMemo(() => {
    if (flow === 'asha_new') {
      return {
        title: 'Patient Registration',
        sub: 'রোগী নিবন্ধন',
        hint: 'Register once, use anytime',
      };
    }
    if (flow === 'asha_edit') {
      return {
        title: 'Edit patient',
        sub: 'রোগী সম্পাদনা',
        hint: 'Update details and save',
      };
    }
    if (flow === 'patient_edit') {
      return {title: 'Your health profile', sub: '', hint: ''};
    }
    return {title: 'Patient registration', sub: '', hint: ''};
  }, [flow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSession();
      if (!session) {
        navigation.replace('RoleSelect');
        return;
      }
      if (flow === 'first_time' || flow === 'patient_edit') {
        const existing = await getPatientSelfProfile(session.phone);
        if (cancelled) {
          return;
        }
        if (existing) {
          setForm({
            fullName: existing.fullName,
            age: existing.age,
            gender: existing.gender,
            phone: existing.phone,
            address: existing.address,
            village: existing.village,
            emergencyContact: existing.emergencyContact,
            bloodGroup: existing.bloodGroup,
            allergies: existing.allergies,
            chronicConditions: existing.chronicConditions,
          });
        } else if (flow === 'first_time') {
          setForm(f => ({...f, phone: session.phone}));
        }
      }
      if ((flow === 'asha_edit' || flow === 'asha_new') && session.role === 'asha') {
        if (flow === 'asha_edit' && editPatientId) {
          const p = await getAshaPatient(session.phone, editPatientId);
          if (p && !cancelled) {
            setForm({
              fullName: p.fullName,
              age: p.age,
              gender: p.gender,
              phone: p.phone,
              address: p.address,
              village: p.village,
              emergencyContact: p.emergencyContact,
              bloodGroup: p.bloodGroup,
              allergies: p.allergies,
              chronicConditions: p.chronicConditions,
            });
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editPatientId, flow, navigation]);

  const set =
    (key: keyof ReturnType<typeof emptyForm>) => (v: string) =>
      setForm(f => ({...f, [key]: v}));

  const save = useCallback(async () => {
    const session = await getSession();
    if (!session) {
      navigation.replace('RoleSelect');
      return;
    }
    if (!form.fullName.trim() || !form.age.trim() || !form.phone.trim()) {
      Alert.alert('Required', 'Name, age, and phone are required.');
      return;
    }
    if (session.role === 'asha' && (flow === 'asha_new' || flow === 'asha_edit') && !form.gender) {
      Alert.alert('Required', 'Please select gender / লিঙ্গ নির্বাচন করুন।');
      return;
    }
    const phone = normalizePhone(form.phone);
    setSaving(true);
    try {
      if (session.role === 'patient') {
        const prev = await getPatientSelfProfile(session.phone);
        const id =
          prev?.id ??
          `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        const profile: PatientProfile = {
          id,
          fullName: form.fullName.trim(),
          age: form.age.trim(),
          gender: form.gender,
          phone,
          address: form.address.trim(),
          village: form.village.trim(),
          emergencyContact: form.emergencyContact.trim(),
          bloodGroup: form.bloodGroup.trim(),
          allergies: form.allergies.trim(),
          chronicConditions: form.chronicConditions.trim(),
          registeredAt: prev?.registeredAt ?? Date.now(),
        };
        await savePatientSelfProfile(profile);
        await setPatientOnboarding(session.phone, {profileDone: true});
        if (flow === 'first_time') {
          navigation.replace('MedicalHistorySetup', {onboarding: true});
        } else {
          navigation.replace('PatientHome');
        }
        return;
      }

      if (session.role === 'asha' && (flow === 'asha_new' || flow === 'asha_edit')) {
        const base: PatientProfile = {
          id:
            flow === 'asha_edit' && editPatientId
              ? editPatientId
              : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
          fullName: form.fullName.trim(),
          age: form.age.trim(),
          gender: form.gender,
          phone,
          address: form.address.trim(),
          village: form.village.trim(),
          emergencyContact: form.emergencyContact.trim(),
          bloodGroup: form.bloodGroup.trim(),
          allergies: form.allergies.trim(),
          chronicConditions: form.chronicConditions.trim(),
          registeredAt:
            flow === 'asha_edit' && editPatientId
              ? (await getAshaPatient(session.phone, editPatientId))?.registeredAt ??
                Date.now()
              : Date.now(),
        };

        const dup = (await listAshaPatients(session.phone)).some(
          p => normalizePhone(p.phone) === phone && p.id !== base.id,
        );
        if (dup) {
          Alert.alert(
            'Duplicate phone',
            'Another patient already uses this number in your list.',
          );
          return;
        }
        await upsertAshaPatient(session.phone, base);
        /** Server sync is best-effort so registration never blocks on Flask / network. */
        void trySyncAshaPatientToServer(base);
        navigation.replace('AshaHome');
        return;
      }
    } catch {
      Alert.alert('Error', 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }, [editPatientId, flow, form, navigation]);

  if (isAshaPatientForm) {
    return (
      <SafeAreaView style={stylesAsha.safe}>
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={stylesAsha.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={stylesAsha.backBtn}>
              <Text style={stylesAsha.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={stylesAsha.headerTitle}>{header.title}</Text>
            {header.sub ? <Text style={stylesAsha.headerBn}>{header.sub}</Text> : null}
            <Text style={stylesAsha.headerHint}>
              {header.hint}
              {'\n'}
              একবার নিবন্ধন করুন, যেকোনো সময় ব্যবহার করুন
            </Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={stylesAsha.scroll}
            contentContainerStyle={stylesAsha.scrollInner}>
            <Text style={stylesAsha.section}>Basic information / মৌলিক তথ্য</Text>

            <FieldAsha
              label="Full name / পূর্ণ নাম *"
              value={form.fullName}
              onChangeText={set('fullName')}
              autoCorrect={false}
              spellCheck={false}
            />
            <FieldAsha
              label="Mobile number / মোবাইল নম্বর *"
              value={form.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
              autoCorrect={false}
              spellCheck={false}
            />
            <FieldAsha
              label="Age / বয়স *"
              value={form.age}
              onChangeText={set('age')}
              keyboardType="number-pad"
            />
            <GenderRowAsha value={form.gender} onChange={g => setForm(f => ({...f, gender: g}))} />
            <FieldAsha
              label="Address / ঠিকানা *"
              value={form.address}
              onChangeText={set('address')}
              multiline
            />
            <FieldAsha
              label="Village / area / গ্রাম / এলাকা"
              value={form.village}
              onChangeText={set('village')}
              autoCorrect={false}
              spellCheck={false}
            />
            <FieldAsha
              label="Emergency contact / জরুরি যোগাযোগ"
              value={form.emergencyContact}
              onChangeText={set('emergencyContact')}
              keyboardType="phone-pad"
            />
            <FieldAsha
              label="Blood group / রক্তের গ্রুপ"
              value={form.bloodGroup}
              onChangeText={set('bloodGroup')}
              placeholder="e.g. O+"
            />
            <FieldAsha
              label="Known allergies / অ্যালার্জি"
              value={form.allergies}
              onChangeText={set('allergies')}
              multiline
            />
            <FieldAsha
              label="Chronic conditions / স্থায়ী রোগ"
              value={form.chronicConditions}
              onChangeText={set('chronicConditions')}
              multiline
            />

            <View style={stylesAsha.infoBox}>
              <Text style={stylesAsha.infoText}>
                প্রথম স্ক্রিনিংয়ের পর প্রোফাইলে যোগ করা যাবে: ডায়াবেটিস, রক্তচাপ, অ্যালার্জি, ABHA
                স্বাস্থ্য ID ইত্যাদি।
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={saving}
              onPress={save}
              style={[stylesAsha.primary, saving && stylesAsha.primaryDisabled]}>
              {saving ? (
                <View style={stylesAsha.rowCenter}>
                  <ActivityIndicator color="#FFFFFF" style={{marginRight: 10}} />
                  <Text style={stylesAsha.primaryText}>Saving… / সংরক্ষণ…</Text>
                </View>
              ) : (
                <Text style={stylesAsha.primaryText}>
                  {flow === 'asha_edit'
                    ? 'Save changes / পরিবর্তন সংরক্ষণ'
                    : 'Register and continue / নিবন্ধন করে এগিয়ে যান'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{header.title}</Text>
          <Text style={styles.sub}>
            Enter details once. Follow-up visits skip this step—select the same patient from your
            portal or home screen.
          </Text>

          <Field
            label="Full name *"
            value={form.fullName}
            onChangeText={set('fullName')}
            autoCorrect={false}
            spellCheck={false}
          />
          <Field
            label="Age *"
            value={form.age}
            onChangeText={set('age')}
            keyboardType="number-pad"
          />
          <GenderRow value={form.gender} onChange={g => setForm(f => ({...f, gender: g}))} />
          <Field
            label="Mobile number *"
            value={form.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
            autoCorrect={false}
            spellCheck={false}
          />
          <Field label="Address *" value={form.address} onChangeText={set('address')} multiline />
          <Field
            label="Village / area"
            value={form.village}
            onChangeText={set('village')}
            autoCorrect={false}
            spellCheck={false}
          />
          <Field
            label="Emergency contact"
            value={form.emergencyContact}
            onChangeText={set('emergencyContact')}
            keyboardType="phone-pad"
          />
          <Field
            label="Blood group"
            value={form.bloodGroup}
            onChangeText={set('bloodGroup')}
            placeholder="e.g. O+"
          />
          <Field
            label="Known allergies"
            value={form.allergies}
            onChangeText={set('allergies')}
            multiline
          />
          <Field
            label="Chronic conditions / medications"
            value={form.chronicConditions}
            onChangeText={set('chronicConditions')}
            multiline
          />

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={saving}
            onPress={save}
            style={[styles.primary, saving && styles.primaryDisabled]}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save profile'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.goBack()}
            style={styles.secondary}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </TouchableOpacity>

          {(flow === 'first_time' || flow === 'patient_edit') && (
            <Text style={styles.regDisclaimer}>{SCREENING_DISCLAIMER}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  placeholder,
  autoCorrect,
  spellCheck,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
  placeholder?: string;
  autoCorrect?: boolean;
  spellCheck?: boolean;
}) {
  return (
    <View style={styles.field} collapsable={false}>
      <Text style={styles.lab}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        autoCorrect={autoCorrect ?? true}
        spellCheck={spellCheck ?? true}
        placeholderTextColor="rgba(148,163,184,0.85)"
        style={[styles.input, multiline && {minHeight: 80, textAlignVertical: 'top'}]}
      />
    </View>
  );
}

function FieldAsha({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  placeholder,
  autoCorrect,
  spellCheck,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
  placeholder?: string;
  autoCorrect?: boolean;
  spellCheck?: boolean;
}) {
  return (
    <View style={stylesAsha.field} collapsable={false}>
      <Text style={stylesAsha.lab}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        autoCorrect={autoCorrect ?? false}
        spellCheck={spellCheck ?? false}
        placeholderTextColor="rgba(71,85,105,0.85)"
        style={[stylesAsha.input, multiline && {minHeight: 80, textAlignVertical: 'top'}]}
      />
    </View>
  );
}

function GenderRow({
  value,
  onChange,
}: {
  value: Gender;
  onChange: (g: Gender) => void;
}) {
  const opts: {key: Gender; label: string}[] = [
    {key: 'male', label: 'Male'},
    {key: 'female', label: 'Female'},
    {key: 'other', label: 'Other'},
  ];
  return (
    <View style={styles.field} collapsable={false}>
      <Text style={styles.lab}>Gender</Text>
      <View style={styles.genderRow}>
        {opts.map(o => {
          const active = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              activeOpacity={0.9}
              onPress={() => onChange(o.key)}
              style={[styles.gChip, active && styles.gChipOn]}>
              <Text style={[styles.gChipText, active && styles.gChipTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function GenderRowAsha({
  value,
  onChange,
}: {
  value: Gender;
  onChange: (g: Gender) => void;
}) {
  const opts: {key: Gender; label: string}[] = [
    {key: 'male', label: 'Male / পুরুষ'},
    {key: 'female', label: 'Female / মহিলা'},
    {key: 'other', label: 'Other / অন্যান্য'},
  ];
  return (
    <View style={stylesAsha.field} collapsable={false}>
      <Text style={stylesAsha.lab}>Gender / লিঙ্গ</Text>
      <View style={stylesAsha.genderRow}>
        {opts.map(o => {
          const active = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              activeOpacity={0.9}
              onPress={() => onChange(o.key)}
              style={[stylesAsha.gChip, active && stylesAsha.gChipOn]}>
              <Text style={[stylesAsha.gChipText, active && stylesAsha.gChipTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const stylesAsha = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#E8F1FF'},
  header: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8},
  backText: {color: '#FFFFFF', fontWeight: '800', fontSize: 16},
  headerTitle: {color: '#FFFFFF', fontSize: 22, fontWeight: '900'},
  headerBn: {color: 'rgba(255,255,255,0.95)', fontSize: 18, fontWeight: '800', marginTop: 4},
  headerHint: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  scroll: {flex: 1, backgroundColor: '#F8FAFC'},
  scrollInner: {padding: 18, paddingBottom: 36},
  section: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  field: {marginBottom: 12},
  lab: {
    color: '#334155',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  genderRow: {flexDirection: 'row', gap: 8},
  gChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  gChipOn: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  gChipText: {color: '#475569', fontWeight: '800', fontSize: 12},
  gChipTextOn: {color: '#1E40AF'},
  infoBox: {
    marginTop: 4,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  infoText: {color: '#1E3A5F', fontSize: 13, lineHeight: 19},
  primary: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryDisabled: {opacity: 0.72},
  primaryText: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
  rowCenter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
});

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 36},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  sub: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 13,
    color: 'rgba(248,250,252,0.72)',
    lineHeight: 18,
  },
  field: {marginBottom: 12},
  lab: {
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
  genderRow: {flexDirection: 'row', gap: 8},
  gChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  gChipOn: {
    borderColor: 'rgba(59,130,246,0.55)',
    backgroundColor: 'rgba(37,99,235,0.25)',
  },
  gChipText: {color: 'rgba(248,250,252,0.75)', fontWeight: '800', fontSize: 13},
  gChipTextOn: {color: '#F8FAFC'},
  primary: {
    marginTop: 8,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryDisabled: {opacity: 0.65},
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  secondary: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  secondaryText: {color: '#F8FAFC', fontWeight: '800'},
  regDisclaimer: {
    marginTop: 16,
    fontSize: 11,
    color: 'rgba(148,163,184,0.9)',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
