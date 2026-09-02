import {api} from './apiClient';

export type SubscriptionTier = {
  id: string;
  tier_name: string;
  price_monthly_rs: number;
  price_annual_rs?: number;
  wound_sessions_per_month?: number;
  skin_sessions_per_month?: number;
  contributing_factor_sessions_per_quarter?: number;
  teleconsult_included_per_month?: number;
  features: string[];
};

export type Subscription = {
  id: string;
  tier_id: string;
  tier_name: string | null;
  status: string;
  trial_ends_at: string | null;
  next_billing_date: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  pause_ends_at: string | null;
  cancelled_at: string | null;
  amount_rs: number;
  auto_renew: boolean;
  module_access_allowed: boolean;
  access_reason?: string | null;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

export async function fetchSubscriptionTiers(): Promise<SubscriptionTier[]> {
  const res = await api.get('/api/v1/subscriptions/tiers');
  return res.data?.data?.tiers ?? [];
}

export async function fetchMySubscription(): Promise<{
  subscription: Subscription | null;
  module_access_allowed: boolean;
}> {
  const res = await api.get('/api/v1/subscriptions/me');
  const data = res.data?.data ?? {};
  return {
    subscription: data.subscription ?? null,
    module_access_allowed: Boolean(data.module_access_allowed),
  };
}

export async function createSubscription(params: {
  tier_id?: string;
  tier_name?: string;
}): Promise<{
  subscription_id: string;
  subscription: Subscription;
  razorpay_order: RazorpayOrder;
  razorpay_key_id: string;
}> {
  const res = await api.post('/api/v1/subscriptions', params);
  return res.data?.data;
}

export async function upgradeSubscription(newTierId: string): Promise<{
  razorpay_order: RazorpayOrder;
  subscription: Subscription;
  razorpay_key_id?: string;
}> {
  const res = await api.post('/api/v1/subscriptions/me/upgrade', {new_tier_id: newTierId});
  return res.data?.data;
}

export async function pauseSubscription(pauseDays: number): Promise<Subscription> {
  const res = await api.post('/api/v1/subscriptions/me/pause', {pause_days: pauseDays});
  return res.data?.data?.subscription;
}

export async function cancelSubscription(reason: string): Promise<Subscription> {
  const res = await api.post('/api/v1/subscriptions/me/cancel', {reason});
  return res.data?.data?.subscription;
}

export function statusLabel(status: string | undefined): string {
  const s = (status ?? '').toUpperCase();
  const map: Record<string, string> = {
    TRIAL: 'Free trial',
    ACTIVE: 'Active',
    PAYMENT_FAILED: 'Payment failed',
    GRACE_PERIOD: 'Grace period',
    SUSPENDED: 'Suspended',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
    PAUSED: 'Paused',
  };
  return map[s] ?? (s || 'Unknown');
}

export function isSubscribedStatus(status: string | undefined): boolean {
  const s = (status ?? '').toUpperCase();
  return ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'].includes(s);
}
