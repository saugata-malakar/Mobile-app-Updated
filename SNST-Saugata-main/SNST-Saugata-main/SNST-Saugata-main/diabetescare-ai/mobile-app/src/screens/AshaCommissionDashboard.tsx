import React, {useCallback, useMemo, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {ASHA_COMMISSION_RATES} from '../constants/ashaCommissions';
import {fetchAshaCommissions} from '../services/ashaCommissionService';
import {getAshaStats, getSession} from '../storage/appStorage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaCommissionDashboard'>;

function monthRangeIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);
  return {from: toYmd(start), to: toYmd(end)};
}

export default function AshaCommissionDashboard({navigation}: {navigation: Nav}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEarned, setTotalEarned] = useState(0);
  const [pending, setPending] = useState(0);
  const [paid, setPaid] = useState(0);
  const [breakdown, setBreakdown] = useState<{commission_type: string; amount_rs: number}[]>([]);
  const [history, setHistory] = useState<
    {commission_type: string; amount_rs: number; earned_at: string; payment_status?: string}[]
  >([]);
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const [showRates, setShowRates] = useState(false);

  const range = useMemo(() => monthRangeIso(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDemoNote(null);
    try {
      const res = await fetchAshaCommissions(range.from, range.to);
      setTotalEarned(res.total_earned);
      setPending(res.pending);
      setPaid(res.paid);
      setBreakdown(res.breakdown ?? []);
      setHistory((res.history ?? []).slice(0, 30));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setError(msg);
      const s = await getSession();
      if (s?.role === 'asha') {
        const st = await getAshaStats(s.phone);
        setTotalEarned(st.totalCommissionINR);
        setPending(st.totalCommissionINR);
        setPaid(0);
        setBreakdown([]);
        setHistory([]);
        setDemoNote('Server summary unavailable — showing local demo commission total only.');
      }
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Commissions</Text>
        <View style={{width: 72}} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sub}>
          This month ({range.from} → {range.to})
        </Text>

        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          <>
            {error ? <Text style={styles.warn}>API: {error}</Text> : null}
            {demoNote ? <Text style={styles.info}>{demoNote}</Text> : null}

            <View style={styles.summaryRow}>
              <View style={styles.sumCard}>
                <Text style={styles.sumLabel}>Total earned</Text>
                <Text style={styles.sumVal}>₹{totalEarned}</Text>
              </View>
              <View style={styles.sumCard}>
                <Text style={styles.sumLabel}>Pending</Text>
                <Text style={styles.sumVal}>₹{pending}</Text>
              </View>
              <View style={styles.sumCard}>
                <Text style={styles.sumLabel}>Paid</Text>
                <Text style={styles.sumVal}>₹{paid}</Text>
              </View>
            </View>

            <Text style={styles.section}>Breakdown by type</Text>
            {breakdown.length === 0 ? (
              <Text style={styles.muted}>No server breakdown rows for this range.</Text>
            ) : (
              breakdown.map((b, i) => (
                <View key={`${b.commission_type}-${i}`} style={styles.row}>
                  <Text style={styles.rowLeft}>{b.commission_type}</Text>
                  <Text style={styles.rowRight}>₹{Number(b.amount_rs).toFixed(0)}</Text>
                </View>
              ))
            )}

            <Text style={styles.section}>Recent events (up to 30)</Text>
            {history.length === 0 ? (
              <Text style={styles.muted}>No history from server yet.</Text>
            ) : (
              history.map((h, i) => (
                <View key={`${h.earned_at}-${i}`} style={styles.histRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.histType}>{h.commission_type}</Text>
                    <Text style={styles.histDate}>{h.earned_at}</Text>
                    {h.payment_status ? (
                      <Text style={styles.histSub}>{h.payment_status}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.histAmt}>₹{Number(h.amount_rs).toFixed(0)}</Text>
                </View>
              ))
            )}

            <TouchableOpacity style={styles.linkBtn} onPress={() => setShowRates(v => !v)}>
              <Text style={styles.linkBtnText}>
                {showRates ? 'Hide' : 'How commissions work'} (rate table)
              </Text>
            </TouchableOpacity>

            {showRates ? (
              <View style={styles.rateCard}>
                {ASHA_COMMISSION_RATES.map(r => (
                  <View key={r.type} style={styles.rateRow}>
                    <Text style={styles.rateLabel}>{r.label}</Text>
                    <Text style={styles.rateAmt}>₹{r.amountRs}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity style={styles.secondary} onPress={load}>
              <Text style={styles.secondaryText}>Refresh</Text>
            </TouchableOpacity>
          </>
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
  sub: {color: 'rgba(248,250,252,0.65)', marginBottom: 14},
  muted: {color: 'rgba(248,250,252,0.55)'},
  warn: {color: '#FCA5A5', marginBottom: 8},
  info: {color: '#FDE68A', marginBottom: 10, lineHeight: 18},
  summaryRow: {flexDirection: 'row', gap: 10, marginBottom: 18},
  sumCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  sumLabel: {fontSize: 11, color: 'rgba(248,250,252,0.6)', fontWeight: '700'},
  sumVal: {marginTop: 6, fontSize: 18, fontWeight: '900', color: '#F8FAFC'},
  section: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  rowLeft: {flex: 1, color: '#E2E8F0', fontSize: 13},
  rowRight: {color: '#86EFAC', fontWeight: '800'},
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  histType: {color: '#F8FAFC', fontWeight: '800'},
  histDate: {marginTop: 4, fontSize: 11, color: 'rgba(248,250,252,0.55)'},
  histSub: {marginTop: 2, fontSize: 11, color: 'rgba(148,163,184,0.85)'},
  histAmt: {fontWeight: '900', color: '#86EFAC'},
  linkBtn: {marginTop: 16, marginBottom: 8},
  linkBtnText: {color: '#93C5FD', fontWeight: '800'},
  rateCard: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  rateRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6},
  rateLabel: {flex: 1, color: '#E2E8F0', fontSize: 13},
  rateAmt: {fontWeight: '800', color: '#A7F3D0'},
  secondary: {
    marginTop: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {color: '#F8FAFC', fontWeight: '800'},
});
