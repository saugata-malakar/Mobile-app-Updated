import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaEnrollMonitoring'>;
type Rt = RouteProp<RootStackParamList, 'AshaEnrollMonitoring'>;

const TIERS = [
  {code: 'BASIC', priceInr: 199, labelEn: 'Basic follow-up', labelBn: 'মৌলিক ফলো-আপ'},
  {code: 'PLUS', priceInr: 399, labelEn: 'Priority teleconsult + reminders', labelBn: 'অগ্রাধিকার টেলিকনসাল্ট + রিমাইন্ডার'},
  {code: 'CARE', priceInr: 699, labelEn: 'Full wound monitoring bundle', labelBn: 'সম্পূর্ণ ক্ষত পর্যবেক্ষণ'},
];

export default function AshaEnrollMonitoring({
  navigation,
  route,
}: {
  navigation: Nav;
  route: Rt;
}) {
  const patientName = route.params?.patientName;
  const patientId = route.params?.patientId;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Commercial care</Text>
        <View style={{width: 72}} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>
          Help the patient enrol in paid monitoring when they want faster access to doctors and
          reminders. Cash collection stays outside the app.
        </Text>
        {(patientName || patientId) && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              Patient: {patientName ?? '—'} {patientId ? `· ${patientId}` : ''}
            </Text>
          </View>
        )}

        <Text style={styles.section}>What the patient gets (সহজ ভাষায়)</Text>
        <Text style={styles.bn}>
          ডাক্তারের টেলিফোন কল, ক্ষতের ছবি রিভিউ, মনে করিয়ে দেওয়া, এবং জরুরি পরামর্শ।
        </Text>
        <Text style={styles.en}>
          Phone teleconsult, wound photo review, reminders, and clearer escalation paths.
        </Text>

        <Text style={styles.section}>Subscription tiers (demo prices)</Text>
        {TIERS.map(t => (
          <View key={t.code} style={styles.tier}>
            <Text style={styles.tierCode}>{t.code}</Text>
            <Text style={styles.tierPrice}>₹{t.priceInr} / month</Text>
            <Text style={styles.tierEn}>{t.labelEn}</Text>
            <Text style={styles.tierBn}>{t.labelBn}</Text>
          </View>
        ))}

        <Text style={styles.section}>Payment options</Text>
        <Text style={styles.bullet}>• Patient pays on their own phone (open Patient app → payments).</Text>
        <Text style={styles.bullet}>• ASHA collects cash at home — record receipt offline, enter payment later on PHC
          workflow (not in this demo app).</Text>

        <TouchableOpacity
          style={styles.primary}
          onPress={() =>
            Alert.alert(
              'Patient phone payment',
              'Ask the patient to open the HealthScreen app on their phone, sign in, and complete subscription checkout.',
            )
          }>
          <Text style={styles.primaryText}>Patient will pay on their phone</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() =>
            Alert.alert(
              'Reminder',
              'Note in your paper register to follow up next visit. Server schedule hook can be added when API is wired.',
            )
          }>
          <Text style={styles.secondaryText}>Patient will subscribe later — set reminder</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  lead: {color: 'rgba(248,250,252,0.75)', lineHeight: 21, marginBottom: 12},
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    marginBottom: 16,
  },
  pillText: {color: '#E0E7FF', fontWeight: '700', fontSize: 13},
  section: {fontSize: 16, fontWeight: '900', color: '#F8FAFC', marginTop: 8, marginBottom: 8},
  bn: {color: '#F8FAFC', lineHeight: 22, marginBottom: 8},
  en: {color: 'rgba(248,250,252,0.72)', lineHeight: 20, marginBottom: 12},
  tier: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  tierCode: {color: '#93C5FD', fontWeight: '900'},
  tierPrice: {marginTop: 4, fontSize: 18, fontWeight: '900', color: '#F8FAFC'},
  tierEn: {marginTop: 6, color: '#E2E8F0'},
  tierBn: {marginTop: 4, color: 'rgba(248,250,252,0.72)', fontSize: 13},
  bullet: {color: 'rgba(248,250,252,0.78)', marginBottom: 8, lineHeight: 20},
  primary: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 15},
  secondary: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  secondaryText: {color: '#F8FAFC', fontWeight: '800'},
});
