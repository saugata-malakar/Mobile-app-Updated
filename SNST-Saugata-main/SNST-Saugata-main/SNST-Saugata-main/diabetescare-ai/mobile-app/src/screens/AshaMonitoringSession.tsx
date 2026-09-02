import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {resetToAshaHome} from '../navigation/navigationUtils';
import {getSession, listAshaPatients} from '../storage/appStorage';
import {
  listActiveAshaPatientWoundSites,
  type AshaPatientWoundSite,
} from '../storage/ashaWoundSitesStorage';
import type {PatientProfile} from '../types/app';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaMonitoringSession'>;
type Rt = RouteProp<RootStackParamList, 'AshaMonitoringSession'>;

export default function AshaMonitoringSession({navigation, route}: {navigation: Nav; route: Rt}) {
  const initialPatientId = route.params?.patientId;
  const initialPatientName = route.params?.patientName;

  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [pickedPatient, setPickedPatient] = useState<{
    id: string;
    name: string;
  } | null>(
    initialPatientId && initialPatientName
      ? {id: initialPatientId, name: initialPatientName}
      : null,
  );
  const [sites, setSites] = useState<AshaPatientWoundSite[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatients = useCallback(async () => {
    const s = await getSession();
    if (s?.role === 'asha') {
      setPatients(await listAshaPatients(s.phone));
    }
  }, []);

  const loadSites = useCallback(async (patientId: string) => {
    setLoading(true);
    const rows = await listActiveAshaPatientWoundSites(patientId);
    setSites(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPatients();
    }, [loadPatients]),
  );

  useEffect(() => {
    if (pickedPatient) {
      void loadSites(pickedPatient.id);
    }
  }, [pickedPatient, loadSites]);

  const startGuide = (
    patientId: string,
    patientName: string,
    woundSiteId: string,
    woundSiteLabel: string,
  ) => {
    navigation.navigate('WoundSessionGuide', {
      wound_site_id: woundSiteId,
      wound_site_label: woundSiteLabel,
      language: 'en',
      screeningContext: {
        sessionRole: 'asha',
        patientId,
        patientName,
        followUp: true,
        submissionMethod: 'ASHA_ASSISTED',
        woundSiteId,
        woundSiteLabel,
      },
    });
  };

  if (!pickedPatient) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Wound monitoring visit (A12)</Text>
          <Text style={styles.sub}>Select a patient, then their active wound site.</Text>
          {patients.length === 0 ? (
            <Text style={styles.muted}>No patients yet — register one from ASHA home.</Text>
          ) : (
            patients.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.row}
                onPress={() => setPickedPatient({id: p.id, name: p.fullName})}>
                <Text style={styles.rowTitle}>{p.fullName}</Text>
                <Text style={styles.rowMeta}>{p.phone}</Text>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity onPress={() => resetToAshaHome(navigation)}>
            <Text style={styles.link}>Back to ASHA home</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Select wound site (A12)</Text>
        <Text style={styles.sub}>{pickedPatient.name}</Text>
        {loading ? (
          <ActivityIndicator style={{marginVertical: 24}} color="#93C5FD" />
        ) : sites.length === 0 ? (
          <>
            <Text style={styles.muted}>
              No wound sites for this patient. Record one first (A11).
            </Text>
            <TouchableOpacity
              style={styles.primary}
              onPress={() =>
                navigation.navigate('AshaWoundSiteSetup', {
                  patientId: pickedPatient.id,
                  patientName: pickedPatient.name,
                })
              }>
              <Text style={styles.primaryText}>Add wound site (A11)</Text>
            </TouchableOpacity>
          </>
        ) : (
          sites.map(s => (
            <TouchableOpacity
              key={s.id}
              style={styles.row}
              onPress={() =>
                startGuide(pickedPatient.id, pickedPatient.name, s.id, s.label)
              }>
              <Text style={styles.rowTitle}>{s.label}</Text>
              <Text style={styles.rowMeta}>
                {s.foot_side} · {s.location_on_foot}
              </Text>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity onPress={() => setPickedPatient(null)}>
          <Text style={styles.link}>Choose different patient</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => resetToAshaHome(navigation)}>
          <Text style={[styles.link, styles.linkSpaced]}>Back to ASHA home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 36},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  sub: {marginTop: 6, color: '#93C5FD', marginBottom: 14},
  muted: {color: 'rgba(248,250,252,0.6)', lineHeight: 20, marginBottom: 16},
  row: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  rowTitle: {color: '#F8FAFC', fontWeight: '800'},
  rowMeta: {marginTop: 4, color: 'rgba(148,163,184,0.9)', fontSize: 12},
  primary: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
  link: {marginTop: 16, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
  linkSpaced: {marginTop: 8},
});
