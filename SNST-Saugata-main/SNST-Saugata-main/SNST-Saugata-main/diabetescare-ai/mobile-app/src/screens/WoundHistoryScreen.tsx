import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WoundHistory'>;
type Rt = RouteProp<RootStackParamList, 'WoundHistory'>;

const SESSIONS = [
  {id: 's1', date: '2026-05-02', dot: 'green' as const, area: '1.38', grade: '2'},
  {id: 's2', date: '2026-04-25', dot: 'amber' as const, area: '1.55', grade: '2'},
  {id: 's3', date: '2026-04-18', dot: 'amber' as const, area: '1.70', grade: '2'},
];

export default function WoundHistoryScreen({navigation, route}: {navigation: Nav; route: Rt}) {
  const {wound_site_id, wound_site_label} = route.params;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.sub}>
          {wound_site_label} · {wound_site_id}
        </Text>

        <Text style={styles.section}>Healing chart</Text>
        <View style={styles.chart}>
          {SESSIONS.map((_, i) => (
            <View key={i} style={[styles.bar, {height: 40 + i * 22}]} />
          ))}
        </View>

        <Text style={styles.section}>Statistics (demo)</Text>
        <Text style={styles.line}>Total area reduction: 12%</Text>
        <Text style={styles.line}>Predicted closure: trend unclear — more data needed</Text>

        <Text style={styles.section}>Sessions</Text>
        {SESSIONS.map(s => (
          <TouchableOpacity
            key={s.id}
            style={styles.row}
            onPress={() =>
              navigation.navigate('WoundResult', {
                session_id: s.id,
                wound_site_id,
                wound_site_label,
                alert_level: s.dot === 'green' ? 'green' : 'amber',
                language: 'en',
              })
            }>
            <View style={[styles.dot, s.dot === 'green' ? styles.g : styles.a]} />
            <View style={{flex: 1}}>
              <Text style={styles.date}>{s.date}</Text>
              <Text style={styles.small}>
                {s.area} cm² · Wagner {s.grade}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>Back</Text>
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
  section: {marginTop: 18, fontWeight: '900', color: '#F8FAFC'},
  chart: {flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 8, marginTop: 10},
  bar: {flex: 1, backgroundColor: 'rgba(59,130,246,0.5)', borderRadius: 8},
  line: {marginTop: 6, color: 'rgba(248,250,252,0.78)'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
    gap: 10,
  },
  dot: {width: 10, height: 10, borderRadius: 99},
  g: {backgroundColor: '#22C55E'},
  a: {backgroundColor: '#F59E0B'},
  date: {color: '#F8FAFC', fontWeight: '800'},
  small: {marginTop: 4, color: 'rgba(248,250,252,0.65)', fontSize: 12},
  chev: {color: '#94A3B8', fontSize: 22},
  back: {marginTop: 20, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
