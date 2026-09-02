import axios, {type AxiosError, type InternalAxiosRequestConfig} from 'axios';
import * as Keychain from 'react-native-keychain';

import {API_BASE_URL} from '../config/api';

const ACCESS_SERVICE = 'com.healthscreen.jwt.access';
const REFRESH_SERVICE = 'com.healthscreen.jwt.refresh';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {'Content-Type': 'application/json'},
});

api.interceptors.request.use(async config => {
  const creds = await Keychain.getGenericPassword({service: ACCESS_SERVICE});
  if (creds) {
    config.headers.Authorization = `Bearer ${creds.password}`;
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {_retry?: boolean};
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const ref = await Keychain.getGenericPassword({service: REFRESH_SERVICE});
      if (!ref) {
        throw error;
      }
      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          {},
          {headers: {Authorization: `Bearer ${ref.password}`}},
        );
        const data = res.data?.data;
        const token = data?.token as string | undefined;
        const refreshToken = data?.refresh_token as string | undefined;
        if (token) {
          await Keychain.setGenericPassword('jwt', token, {service: ACCESS_SERVICE});
        }
        if (refreshToken) {
          await Keychain.setGenericPassword('jwt', refreshToken, {service: REFRESH_SERVICE});
        }
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        await Keychain.resetGenericPassword({service: ACCESS_SERVICE});
        await Keychain.resetGenericPassword({service: REFRESH_SERVICE});
      }
    }
    throw error;
  },
);

export async function persistAuthTokens(access: string, refresh: string) {
  await Keychain.setGenericPassword('jwt', access, {service: ACCESS_SERVICE});
  await Keychain.setGenericPassword('jwt', refresh, {service: REFRESH_SERVICE});
}

export async function clearAuthTokens() {
  await Keychain.resetGenericPassword({service: ACCESS_SERVICE});
  await Keychain.resetGenericPassword({service: REFRESH_SERVICE});
}
