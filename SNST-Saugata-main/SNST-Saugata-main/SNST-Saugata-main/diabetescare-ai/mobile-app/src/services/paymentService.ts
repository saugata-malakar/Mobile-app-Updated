import {api} from './apiClient';
import type {Subscription} from './subscriptionService';

export type PaymentHistoryItem = {
  id: string;
  subscription_id: string | null;
  transaction_type: string;
  amount_rs: number;
  currency: string;
  status: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
};

export async function verifyPayment(params: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}): Promise<{
  success: boolean;
  subscription_active: boolean;
  subscription: Subscription | null;
}> {
  const res = await api.post('/api/v1/payments/verify', params);
  return res.data?.data ?? {success: false, subscription_active: false, subscription: null};
}

export async function fetchPaymentHistory(): Promise<PaymentHistoryItem[]> {
  const res = await api.get('/api/v1/payments/history');
  return res.data?.data?.items ?? [];
}

/** Mock checkout for dev when backend uses RAZORPAY_MOCK=1 */
export async function verifyMockPayment(orderId: string, success: boolean) {
  return verifyPayment({
    razorpay_payment_id: success ? 'pay_success_test' : 'pay_failed_test',
    razorpay_order_id: orderId,
    razorpay_signature: success ? 'mock_sig_ok' : 'mock_sig_fail',
  });
}
