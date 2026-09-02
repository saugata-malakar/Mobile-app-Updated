import axios from 'axios';

const TOKEN_KEY = 'doctor_dashboard_token';
const REFRESH_KEY = 'doctor_dashboard_refresh';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) {
        try {
          const res = await axios.post(
            `${api.defaults.baseURL}/api/v1/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${refresh}` } },
          );
          const token = res.data?.data?.token;
          if (token) {
            localStorage.setItem(TOKEN_KEY, token);
            if (res.data?.data?.refresh_token) {
              localStorage.setItem(REFRESH_KEY, res.data.data.refresh_token);
            }
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          }
        } catch {
          clearAuth();
        }
      }
    }
    throw error;
  },
);

export function persistAuth(token, refresh) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export async function doctorLogin(email, password) {
  const res = await api.post('/api/v1/auth/doctor/login', { email, password });
  const data = res.data?.data;
  if (data?.role && data.role !== 'doctor') {
    throw new Error('Access denied: doctor role required');
  }
  if (!data?.token) {
    throw new Error('Login failed');
  }
  persistAuth(data.token, data.refresh_token);
  return data;
}
