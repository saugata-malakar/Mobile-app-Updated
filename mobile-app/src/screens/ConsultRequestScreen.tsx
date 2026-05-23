import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import type {TeleconsultRequestType} from '../types/teleconsult';
import {createTeleconsult} from '../services/teleconsultService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ConsultRequest'>;

function isoAtLocal(hour: number, minute: number, dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function hoursFromNow(h: number): string {
  const d = new Date();
  d.setTime(d.getTime() + h * 3600 * 1000);
  return d.toISOString();
}

type SlotDef = {id: string; iso: string; labelEn: string; labelBn: string};

export default function ConsultRequestScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const lang: 'en' | 'bn' = route.params?.language === 'bn' ? 'bn' : 'en';
  const sessionId: string | undefined =
    route.params?.sessionId ?? route.params?.session_id;
  const alertId: string | undefined = route.params?.alertId ?? route.params?.alert_id;

  const [mode, setMode] = useState<TeleconsultRequestType>('ROUTINE');
  const [concernEn, setConcernEn] = useState('');
  const [concernBn, setConcernBn] = useState('');
  const [specificEn, setSpecificEn] = useState('');
  const [specificBn, setSpecificBn] = useState('');
  const [slotId, setSlotId] = useState<string>('asap');
  const [submitting, setSubmitting] = useState(false);

  const slots: SlotDef[] = useMemo(
    () => [
      {
        id: 'asap',
        iso: hoursFromNow(1),
        labelEn: 'Soon (within ~1 hour)',
        labelBn: 'শীঘ্র (~১ ঘণ্টার মধ্যে)',
      },
      {
        id: 'today_pm',
        iso: isoAtLocal(16, 30, 0),
        labelEn: 'Today afternoon (4:30 PM)',
        labelBn: 'আজ বিকাল (৪:৩০)',
      },
      {
        id: 'tom_am',
        iso: isoAtLocal(10, 0, 1),
        labelEn: 'Tomorrow morning (10:00 AM)',
        labelBn: 'আগামীকাল সকাল (১০:০০)',
      },
    ],
    [],
  );

  const selectedIso = useMemo(
    () => slots.find(s => s.id === slotId)?.iso ?? slots[0].iso,
    [slots, slotId],
  );

  const t = useMemo(
    () => ({
      title: lang === 'bn' ? 'টেলিকনসাল্ট অনুরোধ' : 'Book a phone callback',
      subtitle:
        lang === 'bn'
          ? 'ডাক্তার আপনার নিবন্ধিত নম্বরে নির্ধারিত সময়ে ফোন করবেন। অ্যাপে ভিডিও/অডিও নেই।'
          : 'A doctor will call your registered phone number at the booked time. There is no in-app video or audio.',
      modeUrgent: lang === 'bn' ? 'জরুরি' : 'Urgent',
      modeRoutine: lang === 'bn' ? 'নিয়মিত' : 'Routine',
      modeFollow: lang === 'bn' ? 'ফলো-আপ' : 'Follow-up',
      qEn: lang === 'bn' ? 'আপনার প্রশ্ন (ইংরেজি)' : 'Your question (English)',
      qBn: lang === 'bn' ? 'আপনার প্রশ্ন (বাংলা, ঐচ্ছিক)' : 'Your question (Bengali, optional)',
      specificEn:
        lang === 'bn'
          ? 'নির্দিষ্ট প্রশ্ন (ইংরেজি, ঐচ্ছিক)'
          : 'Specific question (English, optional)',
      specificBn:
        lang === 'bn'
          ? 'নির্দিষ্ট প্রশ্ন (বাংলা, ঐচ্ছিক)'
          : 'Specific question (Bengali, optional)',
      when: lang === 'bn' ? 'কখন ফোন পেতে চান' : 'Preferred callback time',
      submit: lang === 'bn' ? 'অনুরোধ পাঠান' : 'Submit request',
      session: lang === 'bn' ? 'সেশন' : 'Session',
      alert: lang === 'bn' ? 'সতর্কতা' : 'Alert',
    }),
    [lang],
  );

  const onSubmit = async () => {
    if (!concernEn.trim()) {
      Alert.alert(
        lang === 'bn' ? 'প্রয়োজন' : 'Required',
        lang === 'bn' ? 'ইংরেজিতে আপনার প্রশ্ন লিখুন।' : 'Please describe your question in English.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await createTeleconsult({
        session_id: sessionId ?? null,
        alert_id: alertId ?? null,
        request_type: mode,
        patient_concern_en: concernEn.trim(),
        patient_concern_bn: concernBn.trim() || undefined,
        specific_question_en: specificEn.trim() || undefined,
        specific_question_bn: specificBn.trim() || undefined,
        preferred_callback_time: selectedIso,
      });
        navigation.navigate('QueueStatus', {teleconsultId: res.teleconsult_id, language: lang});
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ??
        (lang === 'bn' ? 'নেটওয়ার্ক ত্রুটি।' : 'Could not submit. Check network and login.');
      Alert.alert(lang === 'bn' ? 'ত্রুটি' : 'Error', String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>

        {(sessionId || alertId) && (
          <View style={styles.chipsRow}>
            {sessionId ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {t.session}: {sessionId.slice(0, 8)}…
                </Text>
              </View>
            ) : null}
            {alertId ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {t.alert}: {alertId.slice(0, 8)}…
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <Text style={styles.section}>{lang === 'bn' ? 'ধরন' : 'Request type'}</Text>
        <View style={styles.row3}>
          {(
            [
              ['URGENT', t.modeUrgent],
              ['ROUTINE', t.modeRoutine],
              ['FOLLOW_UP', t.modeFollow],
            ] as const
          ).map(([k, label]) => (
            <TouchableOpacity
              key={k}
              style={[styles.modeBtn, mode === k && styles.modeBtnOn]}
              onPress={() => setMode(k)}>
              <Text style={[styles.modeBtnText, mode === k && styles.modeBtnTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>{t.qEn}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="Describe your concern…"
          placeholderTextColor="rgba(148,163,184,0.85)"
          value={concernEn}
          onChangeText={setConcernEn}
        />

        <Text style={styles.section}>{t.qBn}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="বাংলায় লিখুন (ঐচ্ছিক)…"
          placeholderTextColor="rgba(148,163,184,0.85)"
          value={concernBn}
          onChangeText={setConcernBn}
        />

        <Text style={styles.section}>{t.specificEn}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="Optional extra detail for the doctor…"
          placeholderTextColor="rgba(148,163,184,0.85)"
          value={specificEn}
          onChangeText={setSpecificEn}
        />

        <Text style={styles.section}>{t.specificBn}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="বাংলায় নির্দিষ্ট প্রশ্ন…"
          placeholderTextColor="rgba(148,163,184,0.85)"
          value={specificBn}
          onChangeText={setSpecificBn}
        />

        <Text style={styles.section}>{t.when}</Text>
        {slots.map(s => (
          <TouchableOpacity
            key={s.id}
            style={[styles.slot, slotId === s.id && styles.slotOn]}
            onPress={() => setSlotId(s.id)}>
            <Text style={[styles.slotText, slotId === s.id && styles.slotTextOn]}>
              {lang === 'bn' ? s.labelBn : s.labelEn}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.primary, submitting && styles.primaryDisabled]}
          disabled={submitting}
          onPress={onSubmit}>
          {submitting ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={styles.primaryText}>{t.submit}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>{lang === 'bn' ? 'পিছনে' : 'Back'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 32},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  subtitle: {marginTop: 10, color: 'rgba(248,250,252,0.75)', lineHeight: 20, fontSize: 14},
  chipsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14},
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.45)',
  },
  chipText: {color: '#E0E7FF', fontSize: 12, fontWeight: '700'},
  section: {marginTop: 18, marginBottom: 8, color: '#94A3B8', fontWeight: '800', fontSize: 13},
  row3: {flexDirection: 'row', gap: 8},
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  modeBtnOn: {borderColor: '#60A5FA', backgroundColor: 'rgba(37,99,235,0.25)'},
  modeBtnText: {color: '#CBD5E1', fontWeight: '800', fontSize: 12},
  modeBtnTextOn: {color: '#F8FAFC'},
  input: {
    minHeight: 88,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    color: '#F8FAFC',
    textAlignVertical: 'top',
  },
  slot: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    marginBottom: 8,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  slotOn: {borderColor: '#34D399', backgroundColor: 'rgba(16,185,129,0.15)'},
  slotText: {color: '#E2E8F0', fontWeight: '700'},
  slotTextOn: {color: '#F8FAFC'},
  primary: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryDisabled: {opacity: 0.65},
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  secondary: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  secondaryText: {color: '#E2E8F0', fontWeight: '800'},
});
