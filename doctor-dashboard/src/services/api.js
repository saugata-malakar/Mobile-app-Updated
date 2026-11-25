import axios from 'axios';
import {
  sandboxAdminMarkPaid,
  sandboxAdminOverride,
  sandboxAdminPayments,
  sandboxAdminStats,
  sandboxAdminSubmissions,
  sandboxAdminUpdateUser,
  sandboxAdminUsers,
  sandboxCreateSubmission,
  sandboxDoctorQueue,
  sandboxDoctorValidate,
  sandboxGetRates,
  sandboxGetSubmission,
  sandboxLogin,
  sandboxModeratorApprove,
  sandboxModeratorQueue,
  sandboxModeratorReject,
  sandboxMyPayments,
  sandboxMySubmissions,
  sandboxRegister,
  sandboxSaveClinicalNote,
  sandboxSubmitRecord,
  sandboxUpdateRates,
  sandboxUploadPhoto,
  sandboxUploadReport,
} from './cloudSandbox';

const TOKEN_KEY = 'doctor_dashboard_token';
const REFRESH_KEY = 'doctor_dashboard_refresh';
const USER_PROFILE_KEY = 'user_profile';
const API_URL_STORAGE_KEY = 'dc_api_base_url';
const SANDBOX_FLAG_KEY = 'dc_sandbox_active';

function readInitialApiBaseUrl() {
  try {
    const saved = localStorage.getItem(API_URL_STORAGE_KEY);
    if (saved !== null && saved.trim() !== '') {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore storage access issues
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL || '';
  return String(envUrl).trim().replace(/\/+$/, '');
}

export let API_BASE_URL = readInitialApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function setApiBaseUrl(url) {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  API_BASE_URL = clean;
  api.defaults.baseURL = clean;
  try {
    if (clean) {
      localStorage.setItem(API_URL_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(API_URL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  return clean;
}

export function isSandboxMode() {
  try {
    return localStorage.getItem(SANDBOX_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function setSandboxFlag(enabled) {
  try {
    if (enabled) localStorage.setItem(SANDBOX_FLAG_KEY, '1');
    else localStorage.removeItem(SANDBOX_FLAG_KEY);
  } catch {
    // ignore
  }
}

export async function pingBackendHealth(candidateUrl) {
  const target = (candidateUrl !== undefined ? candidateUrl : API_BASE_URL).replace(/\/+$/, '');
  try {
    const res = await axios.get(`${target}/health`, { timeout: 3000 });
    const ok = res?.status === 200 && res?.data && typeof res.data === 'object' && 'status' in res.data;
    if (ok) setSandboxFlag(false);
    return Boolean(ok);
  } catch {
    return false;
  }
}

export async function autoDetectBackend() {
  if (await pingBackendHealth(API_BASE_URL)) {
    return { connected: true, url: API_BASE_URL || window.location.origin };
  }
  // When opened on static hosting (e.g. Vercel), try local FastAPI server automatically
  if (!API_BASE_URL && typeof window !== 'undefined' && window.location.port !== '8000') {
    if (await pingBackendHealth('http://localhost:8000')) {
      setApiBaseUrl('http://localhost:8000');
      setSandboxFlag(false);
      return { connected: true, url: 'http://localhost:8000' };
    }
  }
  return { connected: false, url: API_BASE_URL };
}

api.interceptors.request.use((config) => {
  config.baseURL = API_BASE_URL;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function shouldUseSandboxFallback(err) {
  if (!err) return false;
  if (!err.response) return true; // Network error / unreachable backend
  const st = err.response.status;
  if (st === 405 || st === 502 || st === 503 || st === 504) return true;
  if (st === 404 && typeof err.response.data === 'string' && err.response.data.toLowerCase().includes('<html')) {
    return true;
  }
  return false;
}

async function withFallback(remoteFn, sandboxFn) {
  try {
    const res = await remoteFn();
    // Static host SPA rewrite can return HTML with 200 OK on GET /api/...
    if (typeof res?.data === 'string' && res.data.toLowerCase().includes('<!doctype html')) {
      setSandboxFlag(true);
      return await sandboxFn();
    }
    setSandboxFlag(false);
    return unwrap(res);
  } catch (err) {
    if (shouldUseSandboxFallback(err)) {
      setSandboxFlag(true);
      return await sandboxFn();
    }
    throw err;
  }
}

function unwrap(res) {
  if (res?.data && typeof res.data === 'object' && 'data' in res.data && res.data.data !== undefined) {
    return res.data.data;
  }
  return res?.data;
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function persistAuth(token, refresh = 'demo_refresh') {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function persistUserSession(data) {
  if (!data) return;
  const user = data.user || data;
  const role = user.role || data.role || localStorage.getItem('user_role') || 'doctor';
  const userId = user.user_id || data.user_id || data.doctor_id || user.id || '';
  const userName = user.full_name || user.name || data.name || data.full_name || '';
  const workerType = user.worker_type || data.worker_type || '';

  if (data.token) {
    persistAuth(data.token, data.refresh_token || 'refresh_token');
  }
  if (userId) localStorage.setItem('user_id', userId);
  if (role) localStorage.setItem('user_role', role);
  if (userName) localStorage.setItem('user_name', userName);
  if (workerType) {
    localStorage.setItem('worker_type', workerType);
  } else {
    localStorage.removeItem('worker_type');
  }

  const profile = {
    user_id: userId,
    role,
    full_name: userName,
    name: userName,
    email: user.email || data.email || '',
    phone: user.phone || data.phone || '',
    username: user.username || data.username || '',
    worker_id: user.worker_id || data.worker_id || '',
    worker_type: workerType,
    district: user.district || data.district || '',
    specialization: user.specialization || user.specialisation || data.specialization || '',
    status: user.status || 'active',
  };
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed json
  }
  const role = localStorage.getItem('user_role') || 'doctor';
  const userId = localStorage.getItem('user_id') || '';
  const userName = localStorage.getItem('user_name') || '';
  const workerType = localStorage.getItem('worker_type') || '';
  return userId || userName ? { user_id: userId, role, full_name: userName, name: userName, worker_type: workerType } : null;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  localStorage.removeItem('worker_type');
  localStorage.removeItem(USER_PROFILE_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// ── Auth APIs ────────────────────────────────────────────────────────────────

export async function registerUser(payload) {
  const data = await withFallback(
    () => api.post('/api/v1/auth/register', payload),
    () => sandboxRegister(payload)
  );
  persistUserSession(data);
  return data;
}

export async function loginUser(identifier, password, role) {
  const data = await withFallback(
    () =>
      api.post('/api/v1/auth/login', {
        identifier: identifier?.trim(),
        email: identifier?.trim(),
        password,
        role: role || undefined,
      }),
    () => sandboxLogin(identifier, password)
  );
  persistUserSession(data);
  return data;
}

export async function fetchCurrentUser() {
  const data = await withFallback(
    () => api.get('/api/v1/auth/me'),
    () => getStoredUser()
  );
  if (data) persistUserSession({ user: data });
  return data;
}

export async function doctorLogin(email, password) {
  try {
    return await loginUser(email, password);
  } catch (err) {
    if (!shouldUseSandboxFallback(err)) {
      throw err;
    }
    const role = (email || '').toLowerCase().includes('admin') ? 'admin' : 'doctor';
    const fallbackData = {
      user_id: role === 'admin' ? 'ADMIN_MMCH_01' : 'DOC_IITKGP_01',
      doctor_id: 'DOC_IITKGP_01',
      name: role === 'admin' ? 'Hospital Administrator' : 'Dr. Clinical Specialist',
      role,
      token: 'demo_token_authenticated',
      refresh_token: 'demo_refresh_token',
    };
    persistUserSession(fallbackData);
    return fallbackData;
  }
}

// ── Submission Workflow APIs ─────────────────────────────────────────────────

export async function createSubmission(payload) {
  const user = getStoredUser();
  const body = {
    ...payload,
    submitted_by_user_id: payload.submitted_by_user_id || user?.user_id || localStorage.getItem('user_id') || '',
    submitter_role: payload.submitter_role || user?.role || localStorage.getItem('user_role') || '',
    worker_type: payload.worker_type || user?.worker_type || localStorage.getItem('worker_type') || '',
  };
  return withFallback(
    () => api.post('/api/v1/submissions', body),
    () => sandboxCreateSubmission(body)
  );
}

export async function uploadSubmissionPhoto(subId, photoNumber, photoType, base64) {
  return withFallback(
    () =>
      api.post(
        `/api/v1/submissions/${subId}/photos`,
        { photo_number: photoNumber, photo_type: photoType, image_base64: base64 },
        { timeout: 30000 }
      ),
    () => sandboxUploadPhoto(subId, photoNumber, photoType, base64)
  );
}

export async function uploadSubmissionReport(subId, fileName, fileType, base64) {
  return withFallback(
    () =>
      api.post(
        `/api/v1/submissions/${subId}/reports`,
        { file_name: fileName, file_type: fileType, file_base64: base64 },
        { timeout: 30000 }
      ),
    () => sandboxUploadReport(subId, fileName, fileType, base64)
  );
}

export async function saveClinicalNote(subId, notePayload) {
  return withFallback(
    () => api.post(`/api/v1/submissions/${subId}/clinical-note`, notePayload),
    () => sandboxSaveClinicalNote(subId, notePayload)
  );
}

export async function submitWorkflowRecord(subId) {
  return withFallback(
    () => api.post(`/api/v1/submissions/${subId}/submit`, {}, { timeout: 30000 }),
    () => sandboxSubmitRecord(subId)
  );
}

export async function fetchMySubmissions(userId) {
  const uid = userId || localStorage.getItem('user_id') || '';
  return withFallback(
    () => api.get('/api/v1/submissions/my', { params: uid ? { user_id: uid } : {} }),
    () => sandboxMySubmissions(uid)
  );
}

export async function fetchSubmissionDetail(subId) {
  return withFallback(
    () => api.get(`/api/v1/submissions/${subId}`),
    () => sandboxGetSubmission(subId)
  );
}

// ── Moderator APIs ───────────────────────────────────────────────────────────

export async function fetchModeratorQueue(status) {
  return withFallback(
    () => api.get('/api/v1/moderator/queue', { params: status ? { status } : {} }),
    () => sandboxModeratorQueue(status)
  );
}

export async function moderatorApprove(subId, note) {
  return withFallback(
    () => api.post(`/api/v1/moderator/${subId}/approve`, { note: note || '' }),
    () => sandboxModeratorApprove(subId, note)
  );
}

export async function moderatorReject(subId, reason) {
  return withFallback(
    () => api.post(`/api/v1/moderator/${subId}/reject`, { reason }),
    () => sandboxModeratorReject(subId, reason)
  );
}

// ── Doctor Validation Queue APIs ─────────────────────────────────────────────

export async function fetchDoctorValidationQueue() {
  return withFallback(
    () => api.get('/api/v1/doctor/queue'),
    () => sandboxDoctorQueue()
  );
}

export async function doctorValidateSubmission(subId, notePayload) {
  return withFallback(
    () => api.post(`/api/v1/doctor/${subId}/validate`, notePayload),
    () => sandboxDoctorValidate(subId, notePayload)
  );
}

// ── Payments APIs ────────────────────────────────────────────────────────────

export async function fetchMyPayments(userId) {
  const uid = userId || localStorage.getItem('user_id') || '';
  return withFallback(
    () => api.get('/api/v1/payments/my', { params: uid ? { user_id: uid } : {} }),
    () => sandboxMyPayments(uid)
  );
}

// ── Admin APIs ───────────────────────────────────────────────────────────────

export async function fetchAdminStats() {
  return withFallback(
    () => api.get('/api/v1/admin/stats'),
    () => sandboxAdminStats()
  );
}

export async function fetchAdminUsers(role, search) {
  const params = {};
  if (role && role !== 'ALL') params.role = role;
  if (search) params.search = search;
  return withFallback(
    () => api.get('/api/v1/admin/users', { params }),
    () => sandboxAdminUsers(role, search)
  );
}

export async function updateAdminUser(userId, payload) {
  return withFallback(
    () => api.patch(`/api/v1/admin/users/${userId}`, payload),
    () => sandboxAdminUpdateUser(userId, payload)
  );
}

export async function fetchAdminSubmissions(filters = {}) {
  const params = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
      params[k] = v;
    }
  });
  return withFallback(
    () => api.get('/api/v1/admin/submissions', { params }),
    () => sandboxAdminSubmissions(filters)
  );
}

export async function overrideAdminSubmission(subId, decision, reason) {
  return withFallback(
    () =>
      api.post(`/api/v1/admin/submissions/${subId}/override`, {
        decision,
        status: decision,
        reason,
      }),
    () => sandboxAdminOverride(subId, decision, reason)
  );
}

export async function fetchAdminPayments(filters = {}) {
  const params = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
      params[k] = v;
    }
  });
  return withFallback(
    () => api.get('/api/v1/admin/payments', { params }),
    () => sandboxAdminPayments(filters)
  );
}

export async function markAdminPaymentPaid(paymentId) {
  return withFallback(
    () => api.post(`/api/v1/admin/payments/${paymentId}/mark-paid`),
    () => sandboxAdminMarkPaid(paymentId)
  );
}

export async function fetchAdminRates() {
  return withFallback(
    () => api.get('/api/v1/admin/rates'),
    () => sandboxGetRates()
  );
}

export async function updateAdminRates(rates) {
  return withFallback(
    () => api.put('/api/v1/admin/rates', rates),
    () => sandboxUpdateRates(rates)
  );
}
