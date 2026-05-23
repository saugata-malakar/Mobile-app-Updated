import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import type {TeleconsultSummary} from '../types/teleconsult';
import {
  cancelTeleconsult,
  getTeleconsult,
  markTeleconsultReceived,
} from '../services/teleconsultService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'QueueStatus'>;

function fmt(iso: string | null | undefined, lang: 'en' | 'bn') {
  if (!iso) {
    return lang === 'bn' ? 'নির্ধারিত হচ্ছে' : 'To be confirmed';
  }
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === 'bn' ? 'bn-BD' : undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function QueueStatusScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const teleconsultId: string = route.params?.teleconsultId;
  const lang: 'en' | 'bn' = route.params?.language === 'bn' ? 'bn' : 'en';

  const [row, setRow] = useState<TeleconsultSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!teleconsultId) {
      return;
    }
    try {
      const r = await getTeleconsult(teleconsultId);
      setRow(r);
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teleconsultId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const t = {
    title: lang === 'bn' ? 'কলের অবস্থা' : 'Callback status',
    loading: lang === 'bn' ? 'লোড হচ্ছে…' : 'Loading…',
    refresh: lang === 'bn' ? 'রিফ্রেশ' : 'Refresh',
    phoneHint:
      lang === 'bn'
        ? 'নির্ধারিত সময়ে আপনার ফোন চালু রাখুন এবং সাইলেন্ট মোড বন্ধ রাখুন।'
        : 'Keep your phone on and not on silent at the scheduled time.',
    cancel: lang === 'bn' ? 'বাতিল করুন' : 'Cancel booking',
    after: lang === 'bn' ? 'কল শেষ — পরবর্তী ধাপ' : 'After my call — continue',
    back: lang === 'bn' ? 'পিছনে' : 'Back',
  };

  const doctor = row?.assigned_doctor_name ?? (lang === 'bn' ? 'ডাক্তার' : 'Doctor');
  const when = fmt(row?.scheduled_callback_time ?? row?.estimated_callback_time, lang);
  const num = row?.doctor_calling_number ?? '—';

  const line =
    lang === 'bn'
      ? `${doctor} আপনাকে ${when} সময়ে ${num} নম্বর থেকে ফোন করবেন।`
      : `${doctor} will call you at ${when} from ${num}.`;

  const onCancel = async () => {
    if (!row?.can_cancel) {
      return;
    }
    Alert.alert(
      lang === 'bn' ? 'বাতিল?' : 'Cancel?',
      lang === 'bn'
        ? 'আপনি কি এই টেলিকনসাল্ট বাতিল করতে চান?'
        : 'Cancel this scheduled phone callback?',
      [
        {text: lang === 'bn' ? 'না' : 'No', style: 'cancel'},
        {
          text: lang === 'bn' ? 'হ্যাঁ' : 'Yes',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await cancelTeleconsult(teleconsultId);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert(
                'Error',
                String(e?.response?.data?.error?.message ?? 'Cancel failed'),
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onAfterCall = async () => {
    setBusy(true);
    try {
      await markTeleconsultReceived(teleconsultId);
      navigation.replace('TeleconsultComplete', {teleconsultId, language: lang});
    } catch (e: any) {
      Alert.alert(
        lang === 'bn' ? 'ত্রুটি' : 'Error',
        String(
          e?.response?.data?.error?.message ??
            (lang === 'bn'
              ? 'এখনও সময় হয়নি বা সার্ভার ত্রুটি।'
              : 'Too early before your slot, or a server error.'),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading && !row) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#93C5FD" />
          <Text style={styles.muted}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor="#93C5FD"
          />
        }>
        <Text style={styles.title}>{t.title}</Text>

        <View style={styles.card}>
          <Text style={styles.callout}>{line}</Text>
          <Text style={styles.hint}>{t.phoneHint}</Text>
        </View>

        <TouchableOpacity style={styles.secondary} onPress={() => void load()} disabled={busy}>
          <Text style={styles.secondaryText}>{t.refresh}</Text>
        </TouchableOpacity>

        {row?.can_cancel ? (
          <TouchableOpacity style={styles.danger} onPress={onCancel} disabled={busy}>
            <Text style={styles.dangerText}>{t.cancel}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.mutedSmall}>
            {lang === 'bn'
              ? 'নির্ধারিত সময়ের ২ ঘণ্টার মধ্যে বাতিল করা যাবে না।'
              : 'Cancellation is not available within 2 hours of the scheduled call.'}
          </Text>
        )}

        <TouchableOpacity style={styles.primary} onPress={onAfterCall} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={styles.primaryText}>{t.after}</Text>
          )}
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
  scroll: {padding: 20, paddingBottom: 28},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginBottom: 12},
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  callout: {color: '#F8FAFC', fontSize: 16, lineHeight: 24, fontWeight: '700'},
  hint: {marginTop: 12, color: 'rgba(248,250,252,0.78)', lineHeight: 20, fontSize: 14},
  secondary: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  secondaryText: {color: '#E2E8F0', fontWeight: '800'},
  danger: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
  },
  dangerText: {color: '#FECACA', fontWeight: '900'},
  muted: {color: 'rgba(148,163,184,0.95)', marginTop: 8},
  mutedSmall: {marginTop: 12, color: 'rgba(148,163,184,0.9)', fontSize: 13, lineHeight: 18},
  primary: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#059669',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  link: {marginTop: 16, alignItems: 'center'},
  linkText: {color: '#93C5FD', fontWeight: '800'},
});
