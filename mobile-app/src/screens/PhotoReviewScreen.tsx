import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
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
import {resetToPatientHome} from '../navigation/navigationUtils';
import {submitMonitoringSession} from '../services/monitoringSessionService';
import {getSession, recordScreeningCompleted} from '../storage/appStorage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PhotoReview'>;
type Rt = RouteProp<RootStackParamList, 'PhotoReview'>;

export default function PhotoReviewScreen({navigation, route}: {navigation: Nav; route: Rt}) {
  const {wound_site_id, wound_site_label, slots, language, screeningContext} = route.params;
  const lang = language === 'bn' ? 'bn' : 'en';
  const [busy, setBusy] = useState(false);

  const low = useMemo(() => slots.some(s => s.quality < 50), [slots]);
  const isAsha = screeningContext?.sessionRole === 'asha';

  const submit = async () => {
    setBusy(true);
    try {
      if (isAsha && screeningContext) {
        const s = await getSession();
        const result = await submitMonitoringSession(
          {
            patient_id: screeningContext.patientId,
            wound_site_id: screeningContext.woundSiteId ?? wound_site_id,
            submission_method: 'ASHA_ASSISTED',
            photograph_count: slots.length,
          },
          slots,
          screeningContext.patientName,
        );
        try {
          await recordScreeningCompleted({
            mode: 'asha',
            patientId: screeningContext.patientId,
            patientName: screeningContext.patientName,
            conditionKey: 'wound',
            riskLevel: result.riskLevel,
            ashaWorkerPhone: s?.role === 'asha' ? s.phone : undefined,
            followUp: screeningContext.followUp,
          });
        } catch {
          // non-fatal
        }
        navigation.replace('AshaScreeningResult', {
          sessionId: result.sessionId,
          riskLevel: result.riskLevel,
          primaryFinding: result.primaryFinding,
          recommendedAction: result.recommendedAction,
          referralRequired: result.referralRequired,
          queued: result.queued,
          screeningContext,
          language: lang,
        });
        return;
      }

      await new Promise(r => setTimeout(r, 900));
      navigation.replace('WoundResult', {
        session_id: `sess_${Date.now()}`,
        wound_site_id,
        wound_site_label,
        alert_level: low ? 'amber' : 'green',
        language: lang,
      });
    } catch (e) {
      Alert.alert('Submit failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Review photos</Text>
        <Text style={styles.sub}>
          {wound_site_label}
          {isAsha ? ' · ASHA-assisted' : ''}
        </Text>

        <View style={styles.row}>
          {slots.map((s, i) => (
            <View key={i} style={styles.thumb}>
              <View style={styles.thumbBox} />
              <Text style={styles.thumbLbl}>{s.angle}</Text>
              <Text style={styles.badge}>
                {s.quality >= 70 ? 'Good' : s.quality >= 50 ? 'Fair' : 'Retake'}
              </Text>
            </View>
          ))}
        </View>

        {low ? (
          <Text style={styles.warn}>
            {lang === 'bn'
              ? 'কিছু ছবির মান কম — ভালো AI ফলাফলের জন্য পুনরায় তুলতে পারেন।'
              : 'Some photos are low quality. Consider retaking for better AI results.'}
          </Text>
        ) : null}

        <TouchableOpacity style={styles.primary} disabled={busy} onPress={submit}>
          {busy ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={styles.primaryText}>Submit photographs</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              resetToPatientHome(navigation);
            }
          }}>
          <Text style={styles.secondary}>Retake all</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 18, paddingBottom: 36},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  sub: {marginTop: 4, color: 'rgba(148,163,184,0.9)'},
  row: {flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'space-between'},
  thumb: {flex: 1, alignItems: 'center'},
  thumbBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  thumbLbl: {marginTop: 6, fontSize: 11, color: '#E2E8F0', fontWeight: '800'},
  badge: {marginTop: 4, fontSize: 11, color: '#86EFAC', fontWeight: '800'},
  warn: {marginTop: 14, color: '#FDE68A', lineHeight: 20},
  primary: {
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  secondary: {marginTop: 14, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
