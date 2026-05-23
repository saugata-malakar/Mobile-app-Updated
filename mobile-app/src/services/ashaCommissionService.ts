import {api} from './apiClient';
import type {AshaCommissionsApiResponse} from '../types/asha';

/**
 * GET /asha/commissions (Flask: typically mounted as /api/v1/asha/commissions).
 * Query: from_date, to_date (ISO date strings).
 */
export async function fetchAshaCommissions(
  fromDate?: string,
  toDate?: string,
): Promise<AshaCommissionsApiResponse> {
  const res = await api.get<AshaCommissionsApiResponse | {data: AshaCommissionsApiResponse}>(
    '/api/v1/asha/commissions',
    {
      params: {
        ...(fromDate ? {from_date: fromDate} : {}),
        ...(toDate ? {to_date: toDate} : {}),
      },
    },
  );
  const raw = res.data as AshaCommissionsApiResponse & {data?: AshaCommissionsApiResponse};
  const body = raw?.data ?? raw;
  return {
    total_earned: Number(body.total_earned ?? 0),
    pending: Number(body.pending ?? 0),
    paid: Number(body.paid ?? 0),
    breakdown: Array.isArray(body.breakdown) ? body.breakdown : [],
    history: Array.isArray(body.history) ? body.history : undefined,
    payment_history: Array.isArray(body.payment_history) ? body.payment_history : undefined,
  };
}
