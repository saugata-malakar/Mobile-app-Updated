import React, {useMemo} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import {SCREENING_DISCLAIMER} from '../utils/openTelemedicine';

type RiskLevel = 'low' | 'medium' | 'high';

type RecommendationParam =
  | string
  | {
      bn?: string;
      en?: string;
    };

export default function ResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const riskLevel: RiskLevel = route.params?.riskLevel ?? 'low';
  const conditions: string[] = route.params?.conditions ?? [];
  const recommendation: RecommendationParam = route.params?.recommendation ?? '';
  const screeningContext = route.params?.screeningContext;
  const language: 'en' | 'bn' = route.params?.language === 'bn' ? 'bn' : 'en';

  const badge = useMemo(() => {
    switch (riskLevel) {
      case 'high':
        return {label: 'HIGH RISK', bg: 'rgba(239,68,68,0.18)', br: 'rgba(239,68,68,0.55)', fg: '#FEE2E2'};
      case 'medium':
        return {label: 'MEDIUM RISK', bg: 'rgba(245,158,11,0.18)', br: 'rgba(245,158,11,0.55)', fg: '#FEF3C7'};
      default:
        return {label: 'LOW RISK', bg: 'rgba(34,197,94,0.18)', br: 'rgba(34,197,94,0.55)', fg: '#DCFCE7'};
    }
  }, [riskLevel]);

  const top3 = conditions.slice(0, 3);

  const recBn =
    typeof recommendation === 'string'
      ? recommendation
      : recommendation?.bn ?? '';
  const recEn =
    typeof recommendation === 'string'
      ? recommendation
      : recommendation?.en ?? '';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Results</Text>
          <View
            style={[
              styles.badge,
              {backgroundColor: badge.bg, borderColor: badge.br},
            ]}>
            <Text style={[styles.badgeText, {color: badge.fg}]}>
              {badge.label}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top possible conditions</Text>
          {top3.length === 0 ? (
            <Text style={styles.muted}>No conditions provided.</Text>
          ) : (
            top3.map((c, idx) => (
              <View key={`${c}-${idx}`} style={styles.row}>
                <Text style={styles.bullet}>{idx + 1}.</Text>
                <Text style={styles.rowText}>{c}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recommendation</Text>
          <Text style={styles.recoText}>{recBn || '—'}</Text>
          <View style={styles.divider} />
          <Text style={styles.recoText}>{recEn || '—'}</Text>
        </View>

        {screeningContext?.sessionRole === 'patient' && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate('ConsultRequest', {
                screeningContext,
                language,
                sessionId: screeningContext?.monitoringSessionId,
                alertId: screeningContext?.alertId,
                riskLevel,
                conditions,
                recommendation,
              })
            }
            style={styles.teleBtn}>
            <Text style={styles.teleBtnText}>
              {language === 'bn' ? 'টেলিকনসাল্ট বুক করুন' : 'Book teleconsult (phone callback)'}
            </Text>
            <Text style={styles.teleBtnHint}>
              {language === 'bn'
                ? 'নিবন্ধিত নম্বরে ডাক্তার ফোন করবেন। অ্যাপে ভিডিও নেই।'
                : 'A doctor will call your registered number at the booked time. No in-app video or audio.'}
            </Text>
          </TouchableOpacity>
        )}

        {riskLevel === 'high' && screeningContext?.sessionRole === 'asha' && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate('AshaReferralForm', {
                patientId: screeningContext.patientId,
                patientName: screeningContext.patientName,
                riskLevel,
                conditions,
                recommendation:
                  typeof recommendation === 'string'
                    ? recommendation
                    : recommendation?.en ?? recommendation?.bn,
              })
            }
            style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Generate PHC referral slip</Text>
          </TouchableOpacity>
        )}

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>Disclaimer</Text>
          <Text style={styles.disclaimerText}>{SCREENING_DISCLAIMER}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (screeningContext?.sessionRole === 'patient') {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{name: 'PatientHome'}],
                }),
              );
              return;
            }
            if (screeningContext?.sessionRole === 'asha') {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{name: 'AshaHome'}],
                }),
              );
              return;
            }
            navigation.goBack();
          }}
          style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  container: {
    padding: 20,
    paddingBottom: 26,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  header: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  card: {
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  muted: {
    color: 'rgba(248,250,252,0.72)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
  },
  bullet: {
    width: 20,
    color: 'rgba(248,250,252,0.72)',
    fontWeight: '800',
  },
  rowText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 20,
  },
  recoText: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 21,
  },
  divider: {
    marginVertical: 12,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.22)',
  },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
  },
  teleBtn: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  teleBtnText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
  },
  teleBtnHint: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(248,250,252,0.85)',
    textAlign: 'center',
    lineHeight: 16,
  },
  disclaimerBox: {
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(2,6,23,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  disclaimerTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    marginBottom: 4,
  },
  disclaimerText: {
    color: 'rgba(248,250,252,0.72)',
    lineHeight: 18,
  },
  secondaryBtn: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  secondaryBtnText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 15,
  },
});
