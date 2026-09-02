import React, {useCallback, useState} from 'react';
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
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import type {NotificationPrefs} from '../types/notifications';
import {
  getNotificationPreferences,
  postDeviceFcmToken,
  putNotificationPreferences,
} from '../services/notificationService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotificationSettings'>;

function parseDays(s: string): {d1: boolean; d3: boolean} {
  try {
    const a = JSON.parse(s) as unknown;
    if (!Array.isArray(a)) {
      return {d1: true, d3: false};
    }
    const nums = new Set(a.map(x => parseInt(String(x), 10)).filter(n => !Number.isNaN(n)));
    return {d1: nums.has(1), d3: nums.has(3)};
  } catch {
    return {d1: true, d3: false};
  }
}

function buildDays(d1: boolean, d3: boolean): number[] {
  const o: number[] = [];
  if (d1) {
    o.push(1);
  }
  if (d3) {
    o.push(3);
  }
  return o.length ? o : [1];
}

export default function NotificationSettingsScreen({navigation}: {navigation: Nav}) {
  const [lang, setLang] = useState<'en' | 'bn'>('en');
  const [d1, setD1] = useState(true);
  const [d3, setD3] = useState(false);
  const [remTime, setRemTime] = useState('09:00');
  const [overdueOn, setOverdueOn] = useState(true);
  const [overdueDays, setOverdueDays] = useState('2');
  const [sms, setSms] = useState(true);
  const [push, setPush] = useState(true);
  const [pay, setPay] = useState(true);
  const [rx, setRx] = useState(true);
  const [mkt, setMkt] = useState(false);
  const [fcmField, setFcmField] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const t = (() => {
    const L = lang === 'bn';
    return {
      title: L ? 'বিজ্ঞপ্তি সেটিংস' : 'Notification settings',
      lang: L ? 'ভাষা' : 'Language',
      en: 'English',
      bn: 'বাংলা',
      sess: L ? 'সেশন অনুস্মারক' : 'Session reminders',
      d1: L ? '১ দিন আগে' : '1 day before',
      d3: L ? '৩ দিন আগে' : '3 days before',
      time: L ? 'অনুস্মারক সময় (HH:MM)' : 'Reminder time (HH:MM)',
      overdue: L ? 'বিলম্বিত অনুস্মারক' : 'Overdue reminders',
      overdueDays: L ? 'দিন (সর্বোচ্চ ১৪)' : 'Days (max 14)',
      alert: L ? 'সতর্কতা' : 'Alerts',
      sms: 'SMS',
      push: L ? 'পুশ' : 'Push',
      pay: L ? 'পেমেন্ট বিজ্ঞপ্তি' : 'Payment reminders',
      rx: L ? 'প্রেসক্রিপশন বিজ্ঞপ্তি' : 'Prescription notifications',
      mkt: L ? 'মার্কেটিং (ঐচ্ছিক)' : 'Marketing (optional)',
      fcm: L ? 'FCM ডিভাইস টোকেন (ঐচ্ছিক)' : 'FCM device token (optional)',
      save: L ? 'সংরক্ষণ' : 'Save preferences',
      tokenBtn: L ? 'টোকেন জমা দিন' : 'Save device token',
      back: L ? 'পিছনে' : 'Back',
    };
  })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: NotificationPrefs = await getNotificationPreferences();
      const days = parseDays(p.session_reminder_days_before);
      setD1(days.d1);
      setD3(days.d3);
      setRemTime(p.session_reminder_time || '09:00');
      setOverdueOn(p.overdue_reminder_enabled);
      setOverdueDays(String(p.overdue_reminder_after_days ?? 2));
      setSms(p.alert_sms_enabled);
      setPush(p.alert_push_enabled);
      setPay(p.payment_notifications_enabled);
      setRx(p.prescription_notifications_enabled);
      setMkt(p.marketing_enabled);
      setLang(p.language === 'bn' ? 'bn' : 'en');
    } catch {
      Alert.alert('Error', 'Could not load preferences.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSave = async () => {
    let od = parseInt(overdueDays, 10);
    if (Number.isNaN(od)) {
      od = 2;
    }
    od = Math.max(0, Math.min(14, od));
    setSaving(true);
    try {
      await putNotificationPreferences({
        session_reminder_days_before: JSON.stringify(buildDays(d1, d3)),
        session_reminder_time: remTime.trim().slice(0, 8) || '09:00',
        overdue_reminder_enabled: overdueOn,
        overdue_reminder_after_days: od,
        alert_sms_enabled: sms,
        alert_push_enabled: push,
        payment_notifications_enabled: pay,
        prescription_notifications_enabled: rx,
        marketing_enabled: mkt,
        language: lang,
      });
      Alert.alert('Saved', lang === 'bn' ? 'সংরক্ষিত।' : 'Preferences saved.');
    } catch (e: any) {
      Alert.alert(
        'Error',
        String(e?.response?.data?.error?.message ?? 'Save failed — are you logged in with a full account?'),
      );
    } finally {
      setSaving(false);
    }
  };

  const onSaveToken = async () => {
    const tok = fcmField.trim();
    if (!tok) {
      Alert.alert('Token', 'Paste an FCM registration token first.');
      return;
    }
    try {
      await postDeviceFcmToken(tok);
      Alert.alert('OK', lang === 'bn' ? 'টোকেন সংরক্ষিত।' : 'Device token saved on your user account.');
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.error?.message ?? 'Failed'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#93C5FD" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.title}</Text>

        <Text style={styles.section}>{t.lang}</Text>
        <View style={styles.row2}>
          <TouchableOpacity style={[styles.chip, lang === 'en' && styles.chipOn]} onPress={() => setLang('en')}>
            <Text style={styles.chipText}>{t.en}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, lang === 'bn' && styles.chipOn]} onPress={() => setLang('bn')}>
            <Text style={styles.chipText}>{t.bn}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>{t.sess}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setD1(v => !v)}>
          <Text style={styles.rowLabel}>{t.d1}</Text>
          <Text style={styles.rowVal}>{d1 ? '✓' : '—'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => setD3(v => !v)}>
          <Text style={styles.rowLabel}>{t.d3}</Text>
          <Text style={styles.rowVal}>{d3 ? '✓' : '—'}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>{t.time}</Text>
        <TextInput
          style={styles.input}
          value={remTime}
          onChangeText={setRemTime}
          placeholder="09:00"
          placeholderTextColor="rgba(148,163,184,0.8)"
        />

        <Text style={styles.section}>{t.overdue}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setOverdueOn(v => !v)}>
          <Text style={styles.rowLabel}>{lang === 'bn' ? 'চালু' : 'Enabled'}</Text>
          <Text style={styles.rowVal}>{overdueOn ? '✓' : '—'}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>{t.overdueDays}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={overdueDays}
          onChangeText={setOverdueDays}
          placeholder="2"
          placeholderTextColor="rgba(148,163,184,0.8)"
        />

        <Text style={styles.section}>{t.alert}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setSms(v => !v)}>
          <Text style={styles.rowLabel}>{t.sms}</Text>
          <Text style={styles.rowVal}>{sms ? '✓' : '—'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => setPush(v => !v)}>
          <Text style={styles.rowLabel}>{t.push}</Text>
          <Text style={styles.rowVal}>{push ? '✓' : '—'}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>{t.pay}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setPay(v => !v)}>
          <Text style={styles.rowLabel}>{lang === 'bn' ? 'চালু' : 'Enabled'}</Text>
          <Text style={styles.rowVal}>{pay ? '✓' : '—'}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>{t.rx}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setRx(v => !v)}>
          <Text style={styles.rowLabel}>{lang === 'bn' ? 'চালু' : 'Enabled'}</Text>
          <Text style={styles.rowVal}>{rx ? '✓' : '—'}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>{t.mkt}</Text>
        <TouchableOpacity style={styles.row} onPress={() => setMkt(v => !v)}>
          <Text style={styles.rowLabel}>{lang === 'bn' ? 'চালু' : 'Enabled'}</Text>
          <Text style={styles.rowVal}>{mkt ? '✓' : '—'}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>{t.fcm}</Text>
        <TextInput
          style={[styles.input, {minHeight: 44}]}
          value={fcmField}
          onChangeText={setFcmField}
          autoCapitalize="none"
          placeholder="Optional — from Firebase Messaging"
          placeholderTextColor="rgba(148,163,184,0.8)"
        />
        <TouchableOpacity style={styles.secondary} onPress={onSaveToken}>
          <Text style={styles.secondaryText}>{t.tokenBtn}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.primary, saving && {opacity: 0.7}]} disabled={saving} onPress={onSave}>
          {saving ? <ActivityIndicator color="#F8FAFC" /> : <Text style={styles.primaryText}>{t.save}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>{t.back}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 32},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginBottom: 8},
  section: {marginTop: 18, marginBottom: 8, color: '#94A3B8', fontWeight: '800', fontSize: 13},
  hint: {color: 'rgba(148,163,184,0.9)', fontSize: 12, marginBottom: 6},
  row2: {flexDirection: 'row', gap: 10},
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    alignItems: 'center',
  },
  chipOn: {borderColor: '#60A5FA', backgroundColor: 'rgba(37,99,235,0.22)'},
  chipText: {color: '#E2E8F0', fontWeight: '800'},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  rowLabel: {color: '#F8FAFC', fontWeight: '700'},
  rowVal: {color: '#93C5FD', fontWeight: '900', fontSize: 18},
  input: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  primary: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  secondary: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.45)',
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  secondaryText: {color: '#C7D2FE', fontWeight: '800'},
  link: {marginTop: 16, alignItems: 'center'},
  linkText: {color: '#93C5FD', fontWeight: '800'},
});
