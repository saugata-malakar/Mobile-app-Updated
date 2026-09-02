import {api} from './apiClient';
import type {TeleconsultRequestType, TeleconsultSummary} from '../types/teleconsult';

export type CreateTeleconsultBody = {
  session_id?: string | null;
  alert_id?: string | null;
  request_type: TeleconsultRequestType;
  patient_concern_en: string;
  patient_concern_bn?: string;
  /** Optional extra detail (multilingual); server may merge or store separately. */
  specific_question_en?: string;
  specific_question_bn?: string;
  preferred_callback_time: string;
};

export async function createTeleconsult(
  body: CreateTeleconsultBody,
): Promise<{teleconsult_id: string; estimated_callback_time: string | null}> {
  const res = await api.post('/api/v1/teleconsults', body);
  const d = res.data?.data;
  return {
    teleconsult_id: d.teleconsult_id as string,
    estimated_callback_time: (d.estimated_callback_time as string) ?? null,
  };
}

export async function listMyTeleconsults(
  status?: string,
): Promise<TeleconsultSummary[]> {
  const res = await api.get('/api/v1/teleconsults/me', {
    params: status ? {status} : undefined,
  });
  return (res.data?.data ?? []) as TeleconsultSummary[];
}

export async function getTeleconsult(id: string): Promise<TeleconsultSummary> {
  const res = await api.get(`/api/v1/teleconsults/${id}`);
  return res.data?.data as TeleconsultSummary;
}

export async function rateTeleconsult(
  id: string,
  payload: {rating: number; feedback?: string},
): Promise<void> {
  await api.put(`/api/v1/teleconsults/${id}/rate`, payload);
}

export async function markTeleconsultReceived(id: string): Promise<void> {
  await api.post(`/api/v1/teleconsults/${id}/mark-received`, {});
}

export async function cancelTeleconsult(id: string): Promise<void> {
  await api.post(`/api/v1/teleconsults/${id}/cancel`, {});
}
