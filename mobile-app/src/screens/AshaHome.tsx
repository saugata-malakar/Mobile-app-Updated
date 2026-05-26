import React, {useCallback, useState} from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {logoutToRoleSelect} from '../navigation/navigationUtils';
import type {PatientProfile, ScreeningRecord} from '../types/app';
import {
  getAshaStats,
  getSession,
  listAshaPatients,
  listAshaScreenings,
} from '../storage/appStorage';
import {getPendingCount} from '../services/offlineQueue';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaHome'>;

export default function AshaHome({navigation}: {navigation: Nav}) {
  const [workerName, setWorkerName] = useState('');
  const [ashaPhone, setAshaPhone] = useState('');
  const [stats, setStats] = useState({
    patientCount: 0,
    screeningCount: 0,
  });
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [screenings, setScreenings] = useState<ScreeningRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingQueue, setPendingQueue] = useState(0);

  const load = useCallback(async () => {
    const s = await getSession();
    if (!s || s.role !== 'asha') {
      void logoutToRoleSelect(navigation);
      return;
    }
    setWorkerName(s.displayName);
    setAshaPhone(s.phone);
    const [st, plist, recent, qn] = await Promise.all([
      getAshaStats(s.phone),
      listAshaPatients(s.phone),
      listAshaScreenings(s.phone),
      getPendingCount(),
    ]);
    setStats(st);
    setPatients(plist);
    setScreenings(recent.slice(0, 15));
    setPendingQueue(qn);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const signOut = async () => {
    await logoutToRoleSelect(navigation);
  };

  const goScreening = (patient: PatientProfile, followUp: boolean) => {
    navigation.navigate('LanguageSelect', {
      screeningContext: {
        sessionRole: 'asha',
        patientId: patient.id,
        patientName: patient.fullName,
        ashaWorkerPhone: ashaPhone,
        followUp,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={{flex: 1}}>
            <Text style={styles.welcome}>Welcome{workerName ? `, ${workerName}` : ''}</Text>
            <Text style={styles.role}>ASHA portal · patient roster</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.outBtn}>
            <Text style={styles.outBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.patientCount}</Text>
            <Text style={styles.statLabel}>Patients</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.screeningCount}</Text>
            <Text style={styles.statLabel}>Screenings</Text>
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation.navigate('AshaOfflineQueue')}>
            <Text style={styles.quickTitle}>Offline queue</Text>
            <Text style={styles.quickSub}>A16 · {pendingQueue} pending</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.registerBtn}
          onPress={() => navigation.navigate('AshaPatientSearch')}>
          <Text style={styles.registerBtnText}>+ Find / register patient (A7)</Text>
          <Text style={styles.registerHint}>
            Saved under your portal only (offline demo storage).
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.monitorCard}
          onPress={() => navigation.navigate('AshaMonitoringSession', {})}>
          <Text style={styles.monitorTitle}>Wound monitoring visit (A12)</Text>
          <Text style={styles.monitorSub}>
            Patient → wound site → photos → result (offline queue supported)
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Your patients</Text>
        {patients.length === 0 ? (
          <Text style={styles.empty}>No patients yet — register someone above.</Text>
        ) : (
          patients.map(item => (
            <View key={item.id} style={[styles.patientCard, {marginBottom: 10}]}>
              <View style={{flex: 1}}>
                <Text style={styles.pName}>{item.fullName}</Text>
                <Text style={styles.pMeta}>
                  {item.age} yrs · {item.phone}
                </Text>
                <Text style={styles.pAddr} numberOfLines={2}>
                  {item.address}
                  {item.village ? ` · ${item.village}` : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.smallPrimary}
                  onPress={() => goScreening(item, false)}>
                  <Text style={styles.smallPrimaryText}>New visit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.smallGhost}
                  onPress={() => goScreening(item, true)}>
                  <Text style={styles.smallGhostText}>Follow-up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.navigate('AshaWoundSiteSetup', {
                      patientId: item.id,
                      patientName: item.fullName,
                    })
                  }>
                  <Text style={styles.commercialLink}>Record wound site (A11)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.navigate('AshaMonitoringSession', {
                      patientId: item.id,
                      patientName: item.fullName,
                    })
                  }>
                  <Text style={styles.commercialLink}>Wound monitoring visit (A12)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.navigate('PatientRegistration', {
                      flow: 'asha_edit',
                      ashaPatientId: item.id,
                    })
                  }>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, {marginTop: 18}]}>Recent activity</Text>
        {screenings.length === 0 ? (
          <Text style={styles.empty}>Complete a screening to see history here.</Text>
        ) : (
          screenings.map(s => (
            <View key={s.id} style={styles.activityRow}>
              <View style={{flex: 1}}>
                <Text style={styles.actTitle}>{s.patientName}</Text>
                <Text style={styles.actSub}>
                  {new Date(s.createdAt).toLocaleString()} ·{' '}
                  {s.followUp ? 'Follow-up' : 'New visit'} · Risk {s.riskLevel}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 32},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  welcome: {fontSize: 24, fontWeight: '900', color: '#F8FAFC'},
  role: {marginTop: 6, color: 'rgba(248,250,252,0.72)'},
  outBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  outBtnText: {color: '#F8FAFC', fontWeight: '800', fontSize: 13},
  statsRow: {flexDirection: 'row', gap: 10},
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  statNum: {fontSize: 20, fontWeight: '900', color: '#F8FAFC'},
  statLabel: {marginTop: 4, fontSize: 12, color: 'rgba(248,250,252,0.65)'},
  registerBtn: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(37,99,235,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    marginBottom: 18,
  },
  registerBtnText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  registerHint: {marginTop: 6, fontSize: 12, color: 'rgba(248,250,252,0.72)'},
  monitorCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(5,150,105,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    marginBottom: 18,
  },
  monitorTitle: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  monitorSub: {marginTop: 6, fontSize: 12, color: 'rgba(248,250,252,0.72)', lineHeight: 17},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  empty: {color: 'rgba(248,250,252,0.55)', fontSize: 14},
  patientCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  pName: {fontSize: 16, fontWeight: '900', color: '#F8FAFC'},
  pMeta: {marginTop: 4, fontSize: 13, color: 'rgba(248,250,252,0.72)'},
  pAddr: {marginTop: 6, fontSize: 12, color: 'rgba(248,250,252,0.55)'},
  actions: {marginTop: 12, gap: 8},
  smallPrimary: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  smallPrimaryText: {color: '#F8FAFC', fontWeight: '900'},
  smallGhost: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  smallGhostText: {color: '#F8FAFC', fontWeight: '800'},
  editLink: {
    marginTop: 4,
    textAlign: 'center',
    color: '#93C5FD',
    fontWeight: '800',
    paddingVertical: 6,
  },
  commercialLink: {
    marginTop: 2,
    textAlign: 'center',
    color: '#86EFAC',
    fontWeight: '800',
    paddingVertical: 6,
    fontSize: 13,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  actTitle: {fontWeight: '800', color: '#F8FAFC'},
  actSub: {marginTop: 4, fontSize: 12, color: 'rgba(248,250,252,0.6)'},
  quickRow: {flexDirection: 'row', gap: 10, marginBottom: 12},
  quickCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  quickTitle: {color: '#F8FAFC', fontWeight: '900', fontSize: 14},
  quickSub: {marginTop: 4, fontSize: 11, color: 'rgba(248,250,252,0.65)'},
});
