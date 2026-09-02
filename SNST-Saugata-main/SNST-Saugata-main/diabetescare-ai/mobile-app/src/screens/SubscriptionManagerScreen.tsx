import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  cancelSubscription,
  fetchMySubscription,
  fetchSubscriptionTiers,
  isSubscribedStatus,
  pauseSubscription,
  statusLabel,
  type Subscription,
  type SubscriptionTier,
} from '../services/subscriptionService';
import {fetchPaymentHistory, type PaymentHistoryItem} from '../services/paymentService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubscriptionManager'>;

const TIER_FEATURES: Record<string, string[]> = {
  BASIC: [
    'Weekly wound monitoring (4 sessions/month)',
    'Monthly skin assessment',
    'PDF healing reports',
    'Email/SMS alerts',
  ],
  STANDARD: [
    'Everything in Basic',
    'Quarterly contributing-factor triage',
    '1 free teleconsult/month',
    'Doctor dashboard access',
  ],
  PREMIUM: [
    'Everything in Standard',
    '2 teleconsults/month',
    'Priority alert handling',
    'Monthly HbA1c correlation report',
  ],
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function SubscriptionManagerScreen({navigation}: {navigation: Nav}) {
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tierList, mine, payments] = await Promise.all([
        fetchSubscriptionTiers(),
        fetchMySubscription(),
        fetchPaymentHistory().catch(() => [] as PaymentHistoryItem[]),
      ]);
      setTiers(tierList.length ? tierList : []);
      setSubscription(mine.subscription);
      setHistory(payments.slice(0, 6));
    } catch (e: unknown) {
      const msg =
        (e as {response?: {data?: {error?: {message?: string}}}})?.response?.data?.error
          ?.message ?? 'Could not load subscription. Sign in and ensure the API server is running.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const currentTier = subscription?.tier_name?.toUpperCase();
  const status = subscription?.status?.toUpperCase();

  const openPayment = (tier: SubscriptionTier, action: 'subscribe' | 'upgrade') => {
    navigation.navigate('PaymentScreen', {
      tier: tier.tier_name,
      tierId: tier.id,
      amountInr: tier.price_monthly_rs,
      action,
    });
  };

  const confirmPause = () => {
    Alert.alert('Pause subscription', 'Pause for up to 30 days?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Pause 7 days',
        onPress: async () => {
          setActionBusy(true);
          try {
            const sub = await pauseSubscription(7);
            setSubscription(sub);
            Alert.alert('Paused', 'Monitoring pauses until the pause period ends.');
          } catch {
            Alert.alert('Error', 'Could not pause subscription.');
          } finally {
            setActionBusy(false);
          }
        },
      },
    ]);
  };

  const confirmCancel = () => {
    Alert.prompt?.(
      'Cancel subscription',
      'Tell us why you are cancelling (optional):',
      [
        {text: 'Keep plan', style: 'cancel'},
        {
          text: 'Cancel plan',
          style: 'destructive',
          onPress: async (reason?: string) => {
            setActionBusy(true);
            try {
              const sub = await cancelSubscription(reason?.trim() ?? '');
              setSubscription(sub);
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
            } catch {
              Alert.alert('Error', 'Could not cancel subscription.');
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
      'plain-text',
    );
    if (!Alert.prompt) {
      Alert.alert('Cancel subscription', 'This will stop auto-renewal and end paid access.', [
        {text: 'Keep plan', style: 'cancel'},
        {
          text: 'Cancel plan',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            try {
              const sub = await cancelSubscription('');
              setSubscription(sub);
            } catch {
              Alert.alert('Error', 'Could not cancel subscription.');
            } finally {
              setActionBusy(false);
            }
          },
        },
      ]);
    }
  };

  const planActionLabel = (tierName: string): string => {
    if (!subscription || !isSubscribedStatus(status)) {
      return 'Subscribe';
    }
    if (currentTier === tierName) {
      return 'Current plan';
    }
    const order = ['BASIC', 'STANDARD', 'PREMIUM'];
    const curIdx = order.indexOf(currentTier ?? '');
    const newIdx = order.indexOf(tierName);
    if (newIdx > curIdx) {
      return 'Upgrade';
    }
    if (newIdx < curIdx) {
      return 'Change plan';
    }
    return 'Subscribe';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#93C5FD" />}>
        <Text style={styles.title}>Subscription</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Run the HealthScreeningApp Flask API on port 5001 (see backend README).
            </Text>
          </View>
        ) : null}

        <View style={styles.current}>
          <Text style={styles.curTitle}>Current plan</Text>
          {loading && !subscription ? (
            <ActivityIndicator color="#93C5FD" style={{marginTop: 8}} />
          ) : subscription ? (
            <>
              <Text style={styles.curPlan}>
                {subscription.tier_name ?? '—'} · ₹{subscription.amount_rs}/mo
              </Text>
              <Text style={styles.curBody}>Status: {statusLabel(subscription.status)}</Text>
              {subscription.next_billing_date ? (
                <Text style={styles.curBody}>
                  Next billing: {formatDate(subscription.next_billing_date)}
                </Text>
              ) : subscription.trial_ends_at && status === 'TRIAL' ? (
                <Text style={styles.curBody}>Trial ends: {formatDate(subscription.trial_ends_at)}</Text>
              ) : null}
              {!subscription.module_access_allowed ? (
                <Text style={styles.warn}>
                  Monitoring blocked — renew or update payment to continue.
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.curBody}>No subscription yet — start a free trial or choose a plan.</Text>
          )}
        </View>

        {(status === 'ACTIVE' || status === 'TRIAL') && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, actionBusy && styles.disabled]}
              disabled={actionBusy}
              onPress={confirmPause}>
              <Text style={styles.secondaryBtnText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dangerBtn, actionBusy && styles.disabled]}
              disabled={actionBusy}
              onPress={confirmCancel}>
              <Text style={styles.dangerBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {(tiers.length ? tiers : []).map(tier => {
          const name = tier.tier_name.toUpperCase();
          const feats = tier.features?.length ? tier.features : TIER_FEATURES[name] ?? [];
          const label = planActionLabel(name);
          const isCurrent = currentTier === name && isSubscribedStatus(status);
          return (
            <View key={tier.id} style={[styles.plan, isCurrent && styles.planCurrent]}>
              <Text style={styles.planName}>
                {name} · ₹{tier.price_monthly_rs}/mo
              </Text>
              {feats.map(f => (
                <Text key={f} style={styles.feat}>
                  • {f}
                </Text>
              ))}
              <TouchableOpacity
                style={[styles.btn, (isCurrent || label === 'Current plan') && styles.btnDisabled]}
                disabled={isCurrent || label === 'Current plan'}
                onPress={() => openPayment(tier, label === 'Upgrade' ? 'upgrade' : 'subscribe')}>
                <Text style={styles.btnText}>{label}</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {history.length > 0 && (
          <View style={styles.history}>
            <Text style={styles.historyTitle}>Billing history</Text>
            {history.map(h => (
              <View key={h.id} style={styles.historyRow}>
                <Text style={styles.historyMain}>
                  ₹{h.amount_rs} · {h.status}
                </Text>
                <Text style={styles.historySub}>
                  {h.transaction_type} · {formatDate(h.initiated_at)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 18, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  errorText: {color: '#FCA5A5', fontWeight: '700'},
  errorHint: {marginTop: 6, color: 'rgba(252,165,165,0.85)', fontSize: 12},
  current: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  curTitle: {color: '#BFDBFE', fontWeight: '900'},
  curPlan: {marginTop: 6, color: '#F8FAFC', fontWeight: '800', fontSize: 16},
  curBody: {marginTop: 6, color: 'rgba(248,250,252,0.85)', lineHeight: 20},
  warn: {marginTop: 8, color: '#FCD34D', fontWeight: '700'},
  actionsRow: {flexDirection: 'row', gap: 10, marginTop: 12},
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
  },
  secondaryBtnText: {color: '#E2E8F0', fontWeight: '800'},
  dangerBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.45)',
  },
  dangerBtnText: {color: '#FCA5A5', fontWeight: '800'},
  disabled: {opacity: 0.5},
  plan: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  planCurrent: {borderColor: 'rgba(34,197,94,0.5)'},
  planName: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  feat: {marginTop: 6, color: 'rgba(248,250,252,0.78)', fontSize: 13},
  btn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnDisabled: {backgroundColor: 'rgba(37,99,235,0.35)'},
  btnText: {color: '#F8FAFC', fontWeight: '900'},
  history: {marginTop: 20},
  historyTitle: {color: '#BFDBFE', fontWeight: '900', fontSize: 16},
  historyRow: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  historyMain: {color: '#F8FAFC', fontWeight: '700'},
  historySub: {marginTop: 4, color: 'rgba(248,250,252,0.65)', fontSize: 12},
  link: {marginTop: 18, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
