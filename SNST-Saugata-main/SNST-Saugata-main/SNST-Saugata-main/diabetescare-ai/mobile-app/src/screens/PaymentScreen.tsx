import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {RAZORPAY_TEST_KEY_ID} from '../config/razorpay';
import {verifyMockPayment, verifyPayment} from '../services/paymentService';
import {
  createSubscription,
  upgradeSubscription,
  type RazorpayOrder,
} from '../services/subscriptionService';
import {resetToPatientHome} from '../navigation/navigationUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PaymentScreen'>;
type Rt = RouteProp<RootStackParamList, 'PaymentScreen'>;

export default function PaymentScreen({navigation, route}: {navigation: Nav; route: Rt}) {
  const {tier, tierId, amountInr, action = 'subscribe'} = route.params;
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [order, setOrder] = useState<RazorpayOrder | null>(null);
  const [razorpayKey, setRazorpayKey] = useState(RAZORPAY_TEST_KEY_ID);
  const [error, setError] = useState<string | null>(null);

  const prepareOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (action === 'upgrade' && tierId) {
        const data = await upgradeSubscription(tierId);
        setOrder(data.razorpay_order);
        if (data.razorpay_key_id) {
          setRazorpayKey(data.razorpay_key_id);
        }
      } else {
        const data = await createSubscription({
          tier_id: tierId,
          tier_name: tier,
        });
        setOrder(data.razorpay_order);
        if (data.razorpay_key_id) {
          setRazorpayKey(data.razorpay_key_id);
        }
      }
    } catch (e: unknown) {
      const msg =
        (e as {response?: {data?: {error?: {message?: string}}}})?.response?.data?.error
          ?.message ?? 'Could not start checkout. Check login and API server.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [action, tier, tierId]);

  useEffect(() => {
    prepareOrder();
  }, [prepareOrder]);

  const onPaymentSuccess = async (paymentId: string, orderId: string, signature: string) => {
    setPaying(true);
    try {
      const result = await verifyPayment({
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        razorpay_signature: signature,
      });
      if (result.subscription_active) {
        Alert.alert('Success', 'Subscription activated!', [
          {text: 'OK', onPress: () => resetToPatientHome(navigation)},
        ]);
      } else {
        Alert.alert(
          'Payment recorded',
          'Payment received but subscription may need renewal. Check Subscription screen.',
          [{text: 'OK', onPress: () => navigation.goBack()}],
        );
      }
    } catch (e: unknown) {
      const msg =
        (e as {response?: {data?: {error?: {message?: string}}}})?.response?.data?.error
          ?.message ?? 'Payment verification failed.';
      Alert.alert('Verification failed', msg);
    } finally {
      setPaying(false);
    }
  };

  const openRazorpayCheckout = () => {
    if (!order?.id) {
      Alert.alert('Error', 'Order not ready.');
      return;
    }
    const amountPaise = order.amount ?? Math.round(amountInr * 100);
    const options = {
      description: `${tier} plan — monthly`,
      image: undefined as string | undefined,
      currency: order.currency || 'INR',
      key: razorpayKey,
      amount: amountPaise,
      name: 'Diabetes Care AI',
      order_id: order.id,
      prefill: {email: '', contact: ''},
      theme: {color: '#2563EB'},
    };

    RazorpayCheckout.open(options)
      .then((data: {razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string}) => {
        onPaymentSuccess(data.razorpay_payment_id, data.razorpay_order_id, data.razorpay_signature);
      })
      .catch((err: {code?: number; description?: string}) => {
        if (err?.code === 0) {
          return;
        }
        Alert.alert('Payment cancelled', err?.description ?? 'Payment was not completed.');
      });
  };

  const runMockPayment = async (success: boolean) => {
    if (!order?.id) {
      return;
    }
    setPaying(true);
    try {
      if (success) {
        const result = await verifyMockPayment(order.id, true);
        if (result.subscription_active) {
          Alert.alert('Success', 'Subscription activated (test mode).', [
            {text: 'OK', onPress: () => resetToPatientHome(navigation)},
          ]);
        } else {
          Alert.alert('Done', 'Test payment verified.');
          resetToPatientHome(navigation);
        }
      } else {
        await verifyMockPayment(order.id, false);
        Alert.alert('Failed', 'Test payment failed — subscription not activated.');
      }
    } catch (e: unknown) {
      const msg =
        (e as {response?: {data?: {error?: {message?: string}}}})?.response?.data?.error
          ?.message ?? 'Verification failed.';
      Alert.alert('Error', msg);
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.body}>
          Plan {tier} · ₹{amountInr}/month
        </Text>

        {loading ? (
          <ActivityIndicator color="#93C5FD" style={{marginTop: 24}} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={prepareOrder}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Order</Text>
              <Text style={styles.summaryValue}>{order?.id ?? '—'}</Text>
              <Text style={[styles.summaryLabel, {marginTop: 10}]}>Amount</Text>
              <Text style={styles.summaryValue}>
                ₹{((order?.amount ?? amountInr * 100) / 100).toFixed(0)} INR
              </Text>
            </View>

            <Text style={styles.methods}>Payment method</Text>
            <Text style={styles.hint}>UPI, card, or net banking via Razorpay secure checkout.</Text>

            <TouchableOpacity
              style={[styles.primary, paying && styles.disabled]}
              disabled={paying}
              onPress={openRazorpayCheckout}>
              <Text style={styles.primaryText}>
                {paying ? 'Processing…' : 'Pay with Razorpay'}
              </Text>
            </TouchableOpacity>

            {__DEV__ && (
              <View style={styles.mockBlock}>
                <Text style={styles.mockTitle}>Development (TEST keys / mock server)</Text>
                <TouchableOpacity
                  style={styles.mockOk}
                  disabled={paying}
                  onPress={() => runMockPayment(true)}>
                  <Text style={styles.primaryText}>Simulate successful payment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mockFail}
                  disabled={paying}
                  onPress={() => runMockPayment(false)}>
                  <Text style={styles.mockFailText}>Simulate failed payment</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} disabled={paying}>
          <Text style={styles.link}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  body: {marginTop: 12, color: 'rgba(248,250,252,0.78)', lineHeight: 20},
  errorBox: {marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.12)'},
  errorText: {color: '#FCA5A5'},
  retry: {marginTop: 12, alignSelf: 'flex-start'},
  retryText: {color: '#93C5FD', fontWeight: '800'},
  summary: {
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  summaryLabel: {color: 'rgba(248,250,252,0.6)', fontSize: 12},
  summaryValue: {color: '#F8FAFC', fontWeight: '800', marginTop: 4},
  methods: {marginTop: 20, color: '#BFDBFE', fontWeight: '900'},
  hint: {marginTop: 6, color: 'rgba(248,250,252,0.65)', fontSize: 13},
  primary: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#059669',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
  disabled: {opacity: 0.6},
  mockBlock: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    backgroundColor: 'rgba(250,204,21,0.08)',
  },
  mockTitle: {color: '#FDE68A', fontWeight: '800', marginBottom: 10, fontSize: 13},
  mockOk: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  mockFail: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  mockFailText: {color: '#FCA5A5', fontWeight: '800'},
  link: {marginTop: 16, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
