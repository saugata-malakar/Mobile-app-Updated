import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {
  estimateQueuePayloadBytes,
  getLastSuccessfulSyncMs,
  getPendingKindCounts,
  listPendingGroupedByPatient,
} from '../services/offlineQueue';
import type {OfflineQueueRow} from '../services/offlineQueue';
import {flushOfflineQueueNow} from '../services/offlineSync';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaOfflineQueue'>;

export default function AshaOfflineQueue({navigation}: {navigation: Nav}) {
  const [counts, setCounts] = useState({photograph: 0, session: 0, registration: 0, other: 0});
  const [total, setTotal] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [groups, setGroups] = useState<{patientKey: string; label: string; rows: OfflineQueueRow[]}[]>(
    [],
  );
  const [online, setOnline] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [c, b, g, syncMs, net] = await Promise.all([
      getPendingKindCounts(),
      estimateQueuePayloadBytes(),
      listPendingGroupedByPatient(),
      getLastSuccessfulSyncMs(),
      NetInfo.fetch(),
    ]);
    setCounts(c);
    setTotal(c.photograph + c.session + c.registration + c.other);
    setBytes(b);
    setGroups(g);
    setLastSync(syncMs);
    setOnline(!!net.isConnected);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const unsub = NetInfo.addEventListener(s => setOnline(!!s.isConnected));
      return () => unsub();
    }, [refresh]),
  );

  const onUploadNow = async () => {
    if (!online) {
      setUploadMsg('Connect to the internet to upload.');
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const {processed, errors} = await flushOfflineQueueNow();
      setUploadMsg(`Uploaded ${processed} item(s). ${errors ? `${errors} failed.` : ''}`);
      await refresh();
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const fmtKb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Offline queue</Text>
        <View style={{width: 72}} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>
          Pending from local SQLite table <Text style={styles.mono}>offline_queue</Text>
        </Text>

        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {online ? 'Online' : 'Offline — will upload when connected'}
          </Text>
          <Text style={styles.bannerBig}>{total} pending</Text>
        </View>

        <View style={styles.countGrid}>
          <View style={styles.countCell}>
            <Text style={styles.countNum}>{counts.photograph}</Text>
            <Text style={styles.countLbl}>Photographs</Text>
          </View>
          <View style={styles.countCell}>
            <Text style={styles.countNum}>{counts.session}</Text>
            <Text style={styles.countLbl}>Sessions</Text>
          </View>
          <View style={styles.countCell}>
            <Text style={styles.countNum}>{counts.registration}</Text>
            <Text style={styles.countLbl}>Registrations</Text>
          </View>
          <View style={styles.countCell}>
            <Text style={styles.countNum}>{counts.other}</Text>
            <Text style={styles.countLbl}>Other</Text>
          </View>
        </View>

        <Text style={styles.meta}>
          Approx. payload size: {fmtKb(bytes)}
          {'\n'}
          Last successful sync:{' '}
          {lastSync ? new Date(lastSync).toLocaleString() : '—'}
        </Text>

        <TouchableOpacity
          style={[styles.uploadBtn, (!online || uploading) && styles.uploadDisabled]}
          disabled={!online || uploading}
          onPress={onUploadNow}>
          {uploading ? (
            <ActivityIndicator color="#0B1220" />
          ) : (
            <Text style={styles.uploadText}>Upload now</Text>
          )}
        </TouchableOpacity>
        {uploadMsg ? <Text style={styles.uploadNote}>{uploadMsg}</Text> : null}

        <Text style={styles.section}>Per patient</Text>
        {groups.length === 0 ? (
          <Text style={styles.muted}>Nothing queued.</Text>
        ) : (
          groups.map(g => (
            <View key={g.patientKey} style={styles.card}>
              <Text style={styles.pName}>{g.label}</Text>
              <Text style={styles.pMeta}>{g.rows.length} item(s)</Text>
              {g.rows.slice(0, 6).map((r, i) => (
                <Text key={`${g.patientKey}-${i}`} style={styles.pathLine} numberOfLines={1}>
                  {r.path}
                </Text>
              ))}
              {g.rows.length > 6 ? (
                <Text style={styles.more}>+ {g.rows.length - 6} more…</Text>
              ) : null}
            </View>
          ))
        )}
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
  title: {color: '#F8FAFC', fontWeight: '900', fontSize: 17},
  scroll: {padding: 20, paddingBottom: 40},
  lead: {color: 'rgba(248,250,252,0.72)', lineHeight: 20, marginBottom: 14},
  mono: {fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'})},
  banner: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.35)',
    marginBottom: 16,
  },
  bannerText: {color: '#FEF3C7', fontWeight: '700'},
  bannerBig: {marginTop: 8, fontSize: 28, fontWeight: '900', color: '#F8FAFC'},
  countGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14},
  countCell: {
    width: '47%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  countNum: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  countLbl: {marginTop: 4, fontSize: 12, color: 'rgba(248,250,252,0.65)'},
  meta: {color: 'rgba(148,163,184,0.9)', fontSize: 12, lineHeight: 18, marginBottom: 14},
  uploadBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#22C55E',
    marginBottom: 8,
  },
  uploadDisabled: {opacity: 0.45},
  uploadText: {color: '#0B1220', fontWeight: '900', fontSize: 16},
  uploadNote: {color: 'rgba(248,250,252,0.75)', marginBottom: 16},
  section: {fontSize: 16, fontWeight: '900', color: '#F8FAFC', marginBottom: 10},
  muted: {color: 'rgba(248,250,252,0.55)'},
  card: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  pName: {fontWeight: '900', color: '#F8FAFC'},
  pMeta: {marginTop: 4, fontSize: 12, color: 'rgba(248,250,252,0.6)'},
  pathLine: {marginTop: 6, fontSize: 11, color: 'rgba(148,163,184,0.95)'},
  more: {marginTop: 6, fontSize: 12, color: '#93C5FD', fontWeight: '700'},
});
