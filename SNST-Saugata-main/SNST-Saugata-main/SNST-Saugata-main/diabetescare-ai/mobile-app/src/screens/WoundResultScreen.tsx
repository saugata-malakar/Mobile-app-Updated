import React from 'react';
import {Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {resetToPatientHome} from '../navigation/navigationUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WoundResult'>;
type Rt = RouteProp<RootStackParamList, 'WoundResult'>;

export default function WoundResultScreen({navigation, route}: {navigation: Nav; route: Rt}) {
  const {session_id, wound_site_id, wound_site_label, alert_level, language} = route.params;
  const lang = language === 'bn' ? 'bn' : 'en';

  const banner =
    alert_level === 'green'
      ? {
          bg: 'rgba(34,197,94,0.2)',
          fg: '#DCFCE7',
          t: lang === 'bn' ? 'আপনার ক্ষত এই সপ্তাহে ভালো নিরাময় করছে ✓' : 'Your wound is healing well this week ✓',
        }
      : alert_level === 'amber'
        ? {
            bg: 'rgba(245,158,11,0.2)',
            fg: '#FEF3C7',
            t:
              lang === 'bn'
                ? 'আপনার ক্ষতে মনোযোগ দরকার — শীঘ্র ডাক্তারের সাথে কথা বলুন'
                : 'Your wound needs attention — talk to your doctor soon',
          }
        : {
            bg: 'rgba(239,68,68,0.22)',
            fg: '#FEE2E2',
            t:
              lang === 'bn'
                ? 'জরুরি — আজই ক্ষত পরিচর্যা প্রয়োজন'
                : 'URGENT — your wound needs care today',
          };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.banner, {backgroundColor: banner.bg}]}>
          <Text style={[styles.bannerText, {color: banner.fg}]}>{banner.t}</Text>
        </View>

        <Text style={styles.meta}>
          Session {session_id} · {wound_site_label} ({wound_site_id})
        </Text>

        <Text style={styles.section}>Key measurements</Text>
        <View style={styles.grid}>
          <Tile label="Wound area" value="1.4 cm²" hint="↓ vs last week" />
          <Tile label="Wagner grade" value="2" hint="—" />
          <Tile label="Tissue" value="Granulation" hint="●" />
          <Tile label="Infection risk" value="LOW" hint="18%" />
        </View>

        <Text style={styles.section}>Healing progress</Text>
        <Text style={styles.body}>Area trend (demo): improving ↓ over last 4 sessions.</Text>

        <Text style={styles.section}>AI observations</Text>
        <Text style={styles.bullet}>• Area decreased ~12% this week.</Text>
        <Text style={styles.bullet}>• Some slough present — discuss with your doctor.</Text>

        <Text style={styles.section}>What to do next</Text>
        {alert_level === 'green' ? (
          <Text style={styles.body}>Continue current care. Next check: in 7 days.</Text>
        ) : alert_level === 'amber' ? (
          <Text style={styles.body}>Contact clinic within 2–3 days.</Text>
        ) : (
          <Text style={styles.body}>Seek medical care today.</Text>
        )}

        {alert_level === 'amber' || alert_level === 'red' ? (
          <TouchableOpacity
            style={styles.tele}
            onPress={() =>
              navigation.navigate('ConsultRequest', {
                language: lang,
                sessionId: session_id,
                riskLevel: alert_level === 'red' ? 'high' : 'medium',
              })
            }>
            <Text style={styles.teleText}>Book teleconsult</Text>
          </TouchableOpacity>
        ) : null}

        {alert_level === 'red' ? (
          <TouchableOpacity
            style={styles.call}
            onPress={() => Alert.alert('Call', 'Wire consultation_phone from API in production.')}>
            <Text style={styles.callText}>CALL DOCTOR NOW</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.home} onPress={() => resetToPatientHome(navigation)}>
          <Text style={styles.homeText}>Back to home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({label, value, hint}: {label: string; value: string; hint: string}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileL}>{label}</Text>
      <Text style={styles.tileV}>{value}</Text>
      <Text style={styles.tileH}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 18, paddingBottom: 40},
  banner: {padding: 16, borderRadius: 14, marginBottom: 10},
  bannerText: {fontWeight: '900', fontSize: 16, lineHeight: 22},
  meta: {color: 'rgba(148,163,184,0.9)', fontSize: 12, marginBottom: 12},
  section: {marginTop: 14, fontWeight: '900', color: '#F8FAFC', fontSize: 16},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8},
  tile: {
    width: '47%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  tileL: {color: 'rgba(248,250,252,0.65)', fontSize: 11},
  tileV: {marginTop: 6, color: '#F8FAFC', fontWeight: '900', fontSize: 18},
  tileH: {marginTop: 4, color: '#93C5FD', fontSize: 12},
  body: {marginTop: 6, color: 'rgba(248,250,252,0.78)', lineHeight: 20},
  bullet: {marginTop: 6, color: 'rgba(248,250,252,0.85)', lineHeight: 20},
  tele: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#6366F1',
  },
  teleText: {color: '#F8FAFC', fontWeight: '900'},
  call: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  callText: {color: '#F8FAFC', fontWeight: '900'},
  home: {marginTop: 18, padding: 14, alignItems: 'center'},
  homeText: {color: '#94A3B8', fontWeight: '800'},
});
