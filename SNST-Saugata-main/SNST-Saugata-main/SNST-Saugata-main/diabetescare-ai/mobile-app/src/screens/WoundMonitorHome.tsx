import React, {useMemo} from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {logoutToRoleSelect, resetToPatientHome} from '../navigation/navigationUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WoundMonitorHome'>;
type Rt = RouteProp<RootStackParamList, 'WoundMonitorHome'>;

const MOCK_AREAS = [2.4, 2.2, 2.0, 1.85, 1.7, 1.55, 1.45, 1.38];

export default function WoundMonitorHome({navigation, route}: {navigation: Nav; route: Rt}) {
  const {wound_site_id, wound_site_label} = route.params;
  const status = ((): 'green' | 'amber' | 'red' => 'amber')();

  const nextDue = useMemo(() => 'DUE TODAY', []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>{wound_site_label} wound</Text>
        <Text style={styles.meta}>Site id: {wound_site_id}</Text>

        <Text style={styles.section}>Healing trend (demo)</Text>
        <Text style={styles.hint}>
          {MOCK_AREAS.length >= 2
            ? 'Area (cm²) over last sessions — connect API for live data.'
            : 'Take your first 2 photographs to see your healing trend.'}
        </Text>
        <View style={styles.chartRow}>
          {MOCK_AREAS.map((a, i) => (
            <View key={i} style={styles.barWrap}>
              <View style={[styles.bar, {height: 20 + a * 28}]} />
              <Text style={styles.barLbl}>{i + 1}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>This week\u2019s status</Text>
          <View style={styles.row}>
            <Dot color={status} />
            <Text style={styles.cardBody}>Last session: 2 days ago · AI notes stable slough</Text>
          </View>
          {status === 'red' ? (
            <Text style={styles.redAction}>ACTION NEEDED — contact your clinic today.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next session</Text>
          <Text style={styles.due}>{nextDue}</Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() =>
              navigation.navigate('WoundSessionGuide', {
                wound_site_id,
                wound_site_label,
                language: 'en',
              })
            }>
            <Text style={styles.primaryText}>Photograph now</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <Stat k="First detected" v="—" />
          <Stat k="Weeks monitored" v="6" />
          <Stat k="Area change" v="-12%" />
          <Stat k="Wagner grade" v="2" />
        </View>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => navigation.navigate('WoundHistory', {wound_site_id, wound_site_label})}>
          <Text style={styles.secondaryText}>View full history</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => resetToPatientHome(navigation)}>
          <Text style={styles.link}>Back to patient home</Text>
        </TouchableOpacity>
        <Text style={styles.switchHint}>Need the other role (patient or ASHA)?</Text>
        <TouchableOpacity onPress={() => void logoutToRoleSelect(navigation)}>
          <Text style={[styles.link, styles.switchLink]}>Who is using this device?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Dot({color}: {color: 'green' | 'amber' | 'red'}) {
  const c =
    color === 'green' ? '#22C55E' : color === 'amber' ? '#F59E0B' : '#EF4444';
  return <View style={[styles.dot, {backgroundColor: c}]} />;
}

function Stat({k, v}: {k: string; v: string}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statK}>{k}</Text>
      <Text style={styles.statV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 18, paddingBottom: 36},
  header: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  meta: {marginTop: 4, color: 'rgba(148,163,184,0.9)', fontSize: 12},
  section: {marginTop: 18, fontWeight: '900', color: '#F8FAFC', fontSize: 16},
  hint: {marginTop: 6, color: 'rgba(248,250,252,0.65)', lineHeight: 18},
  chartRow: {flexDirection: 'row', alignItems: 'flex-end', height: 220, marginTop: 12, gap: 6},
  barWrap: {flex: 1, alignItems: 'center', justifyContent: 'flex-end'},
  bar: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.55)',
    minHeight: 8,
  },
  barLbl: {marginTop: 4, fontSize: 10, color: 'rgba(248,250,252,0.55)'},
  card: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  cardTitle: {color: '#F8FAFC', fontWeight: '900', marginBottom: 8},
  row: {flexDirection: 'row', gap: 10, alignItems: 'flex-start'},
  dot: {width: 12, height: 12, borderRadius: 99, marginTop: 4},
  cardBody: {flex: 1, color: 'rgba(248,250,252,0.85)', lineHeight: 20},
  redAction: {marginTop: 10, color: '#FECACA', fontWeight: '900'},
  due: {fontSize: 18, fontWeight: '900', color: '#FDE68A', marginBottom: 10},
  primary: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
  stats: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16},
  statCell: {
    width: '47%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  statK: {color: 'rgba(248,250,252,0.6)', fontSize: 11},
  statV: {marginTop: 4, color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  secondary: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  secondaryText: {color: '#E2E8F0', fontWeight: '800'},
  link: {marginTop: 18, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
  switchHint: {
    marginTop: 10,
    textAlign: 'center',
    color: 'rgba(148,163,184,0.75)',
    fontSize: 13,
  },
  switchLink: {marginTop: 2},
});
