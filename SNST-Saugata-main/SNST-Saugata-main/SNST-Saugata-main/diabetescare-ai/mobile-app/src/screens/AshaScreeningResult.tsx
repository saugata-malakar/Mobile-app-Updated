import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaScreeningResult'>;
type Rt = RouteProp<RootStackParamList, 'AshaScreeningResult'>;

export default function AshaScreeningResult({navigation, route}: {navigation: Nav; route: Rt}) {
  const {
    riskLevel,
    primaryFinding,
    recommendedAction,
    referralRequired,
    queued,
    screeningContext,
  } = route.params;

  const badge =
    riskLevel === 'high'
      ? {label: 'HIGH RISK', bg: 'rgba(239,68,68,0.2)', fg: '#FEE2E2'}
      : riskLevel === 'medium'
        ? {label: 'MEDIUM RISK', bg: 'rgba(245,158,11,0.2)', fg: '#FEF3C7'}
        : {label: 'LOW RISK', bg: 'rgba(34,197,94,0.2)', fg: '#DCFCE7'};

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Screening result (A9)</Text>
        <Text style={styles.sub}>{screeningContext.patientName}</Text>
        {queued ? (
          <Text style={styles.queue}>
            Saved offline — session will upload when connected.
          </Text>
        ) : null}

        <View style={[styles.badge, {backgroundColor: badge.bg}]}>
          <Text style={[styles.badgeText, {color: badge.fg}]}>{badge.label}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Primary finding</Text>
          <Text style={styles.cardBody}>{primaryFinding}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommended action</Text>
          <Text style={styles.cardBody}>{recommendedAction}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Referral required</Text>
          <Text style={styles.cardBody}>{referralRequired ? 'YES' : 'NO'}</Text>
        </View>

        {referralRequired && riskLevel === 'high' ? (
          <TouchableOpacity
            style={styles.referral}
            onPress={() =>
              navigation.navigate('AshaReferralForm', {
                patientId: screeningContext.patientId,
                patientName: screeningContext.patientName,
                riskLevel,
                conditions: [primaryFinding],
                recommendation: recommendedAction,
                urgency: 'URGENT',
                specialist: 'Physician / surgeon at PHC',
              })
            }>
            <Text style={styles.referralText}>Generate PHC referral slip (A17)</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.done}
          onPress={() =>
            navigation.dispatch(
              CommonActions.reset({index: 0, routes: [{name: 'AshaHome'}]}),
            )
          }>
          <Text style={styles.doneText}>Done — back to ASHA home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  sub: {marginTop: 4, color: '#93C5FD', fontWeight: '800'},
  queue: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.15)',
    color: '#FDE68A',
    fontWeight: '700',
  },
  badge: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  badgeText: {fontWeight: '900', fontSize: 18},
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  cardTitle: {color: '#94A3B8', fontWeight: '800', fontSize: 12, marginBottom: 6},
  cardBody: {color: '#F8FAFC', lineHeight: 22, fontWeight: '600'},
  referral: {
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  referralText: {color: '#F8FAFC', fontWeight: '900'},
  done: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 14,
  },
  doneText: {color: '#93C5FD', fontWeight: '800'},
});
