import React, {useCallback, useEffect, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {getPatientSelfProfile, getSession} from '../storage/appStorage';
import type {PatientProfile} from '../types/app';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PatientProfile'>;

type Tab = 'history' | 'rx' | 'progress' | 'medical';

export default function PatientProfileScreen({navigation}: {navigation: Nav}) {
  const route = useRoute<RouteProp<RootStackParamList, 'PatientProfile'>>();
  const [tab, setTab] = useState<Tab>('history');
  const [profile, setProfile] = useState<PatientProfile | null>(null);

  useEffect(() => {
    const it = route.params?.initialTab;
    if (it) {
      setTab(it);
    }
  }, [route.params?.initialTab]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const s = await getSession();
        if (s?.role === 'patient') {
          setProfile(await getPatientSelfProfile(s.phone));
        }
      })();
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.tabs}>
        {(['history', 'rx', 'progress', 'medical'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabT, tab === t && styles.tabTOn]}>
              {t === 'history' ? 'History' : t === 'rx' ? 'Rx' : t === 'progress' ? 'Progress' : 'Medical'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 'medical' && (
          <>
            <Text style={styles.h}>Medical</Text>
            <Text style={styles.body}>
              Diabetes duration, HbA1c, medications — update via Medical History (demo values not stored here).
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigation.navigate('MedicalHistorySetup', {})}>
              <Text style={styles.btnText}>Update medical history</Text>
            </TouchableOpacity>
          </>
        )}
        {tab === 'history' && (
          <Text style={styles.body}>Visit history will list screenings and wound sessions from the server.</Text>
        )}
        {tab === 'rx' && <Text style={styles.body}>Prescriptions appear after teleconsults complete.</Text>}
        {tab === 'progress' && (
          <>
            <Text style={styles.body}>Healing progress and charts.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('ProgressReport')}>
              <Text style={styles.btnText}>Open progress report</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.h}>Subscription</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('SubscriptionManager')}>
          <Text style={styles.btnText}>Manage subscription</Text>
        </TouchableOpacity>

        {profile && (
          <Text style={styles.footer}>
            {profile.fullName} · {profile.phone}
          </Text>
        )}
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  tabs: {flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8, gap: 6},
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  tabOn: {borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.12)'},
  tabT: {color: 'rgba(248,250,252,0.7)', fontWeight: '800', fontSize: 12},
  tabTOn: {color: '#F8FAFC'},
  scroll: {padding: 16, paddingBottom: 32},
  h: {fontSize: 18, fontWeight: '900', color: '#F8FAFC', marginTop: 8},
  body: {marginTop: 8, color: 'rgba(248,250,252,0.78)', lineHeight: 20},
  btn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnText: {color: '#F8FAFC', fontWeight: '900'},
  footer: {marginTop: 20, color: 'rgba(148,163,184,0.9)', fontSize: 12},
  link: {marginTop: 16, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
