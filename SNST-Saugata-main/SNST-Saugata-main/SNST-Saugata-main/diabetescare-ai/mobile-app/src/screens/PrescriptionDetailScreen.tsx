import React, {useMemo} from 'react';
import {Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {TeleconsultPrescription} from '../types/teleconsult';

function medLines(meds: unknown): string {
  if (!meds) {
    return '—';
  }
  if (typeof meds === 'string') {
    return meds;
  }
  if (Array.isArray(meds)) {
    return meds
      .map((m: any) => {
        if (typeof m === 'string') {
          return m;
        }
        if (m && typeof m === 'object') {
          return [m.name, m.dose, m.frequency, m.duration].filter(Boolean).join(' · ');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return JSON.stringify(meds);
}

export default function PrescriptionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const lang: 'en' | 'bn' = route.params?.language === 'bn' ? 'bn' : 'en';
  const p: TeleconsultPrescription = route.params?.prescription ?? {};

  const wound = lang === 'bn' ? p.wound_care_instructions_bn || p.wound_care_instructions_en : p.wound_care_instructions_en;

  const t = useMemo(
    () => ({
      title: lang === 'bn' ? 'প্রেসক্রিপশন' : 'Prescription',
      dx: lang === 'bn' ? 'রোগ নির্ণয়' : 'Diagnosis',
      meds: lang === 'bn' ? 'ঔষধ' : 'Medications',
      wound: lang === 'bn' ? 'ক্ষত পরিচর্যা' : 'Wound care',
      dress: lang === 'bn' ? 'ড্রেসিং' : 'Dressing instructions',
      ref: lang === 'bn' ? 'রেফারেল' : 'Referral',
      valid: lang === 'bn' ? 'বৈধ পর্যন্ত' : 'Valid until',
      share: lang === 'bn' ? 'ফার্মাসিস্টের সাথে শেয়ার (PDF)' : 'Share with pharmacist (PDF)',
      back: lang === 'bn' ? 'পিছনে' : 'Back',
    }),
    [lang],
  );

  const onShare = () => {
    Alert.alert(
      lang === 'bn' ? 'শীঘ্রই' : 'Coming soon',
      lang === 'bn'
        ? 'PDF তৈরি সার্ভার থেকে উপলব্ধ হবে।'
        : 'A printable PDF will be generated on the server for this prescription.',
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.title}</Text>

        <Section label={t.dx} body={p.diagnosis ?? '—'} />
        <Section label={t.meds} body={medLines(p.medications)} />
        <Section label={t.wound} body={wound ?? '—'} />
        <Section label={t.dress} body={p.dressing_instructions ?? '—'} />
        {p.referral_required ? (
          <Section label={t.ref} body={p.referral_details ?? (lang === 'bn' ? 'রেফারেল প্রয়োজন' : 'Referral required')} />
        ) : (
          <Section label={t.ref} body={lang === 'bn' ? 'প্রয়োজন নেই' : 'Not required'} />
        )}
        <Section label={t.valid} body={p.valid_until ?? '—'} />

        <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
          <Text style={styles.shareBtnText}>{t.share}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({label, body}: {label: string; body: string}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 28},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginBottom: 8},
  card: {
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  label: {color: '#94A3B8', fontWeight: '800', marginBottom: 6, fontSize: 13},
  body: {color: '#F8FAFC', lineHeight: 22, fontSize: 15},
  shareBtn: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#6366F1',
  },
  shareBtnText: {color: '#F8FAFC', fontWeight: '900', fontSize: 15},
  back: {marginTop: 14, alignItems: 'center', paddingVertical: 12},
  backText: {color: '#93C5FD', fontWeight: '800'},
});
