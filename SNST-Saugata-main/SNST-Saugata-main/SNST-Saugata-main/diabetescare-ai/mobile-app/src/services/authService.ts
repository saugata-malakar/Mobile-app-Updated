import axios from 'axios';
import {API_BASE_URL} from '../config/api';
import {clearAuthTokens, persistAuthTokens} from './apiClient';
import type {AppRole} from '../types/app';

export type AuthTokens = {
  token: string;
  refresh_token: string;
  user_id: string;
  role: string;
};

/** Register on Flask; stores JWT when server responds. Does not throw on network failure. */
export async function registerWithServer(
  phone: string,
  password: string,
  fullName: string,
  role: AppRole,
): Promise<AuthTokens | null> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/v1/auth/register`,
      {
        phone_number: phone,
        password,
        full_name: fullName,
        role,
      },
      {timeout: 12000},
    );
    const data = res.data?.data;
    if (data?.token && data?.refresh_token) {
      await persistAuthTokens(data.token, data.refresh_token);
      return data as AuthTokens;
    }
  } catch {
    // Offline or server down — local-only mode still works.
  }
  return null;
}

export async function loginWithServer(
  phone: string,
  password: string,
  role: AppRole,
): Promise<AuthTokens | null> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/v1/auth/login`,
      {phone_number: phone, password, role},
      {timeout: 12000},
    );
    const data = res.data?.data;
    if (data?.token && data?.refresh_token) {
      await persistAuthTokens(data.token, data.refresh_token);
      return data as AuthTokens;
    }
  } catch {
    // ignore
  }
  return null;
}

/** ASHA worker login — matches backend seed asha001/1234, asha002/1234. */
export async function loginAshaWithServer(
  workerId: string,
  pin: string,
): Promise<AuthTokens | null> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/v1/auth/asha/login`,
      {worker_id: workerId.trim().toLowerCase(), pin},
      {timeout: 12000},
    );
    const data = res.data?.data;
    if (data?.token && data?.refresh_token) {
      await persistAuthTokens(data.token, data.refresh_token);
      return data as AuthTokens;
    }
  } catch {
    // Offline or server down — local demo accounts still work.
  }
  return null;
}

export async function logoutServer() {
  await clearAuthTokens();
}
