import RNFS from 'react-native-fs';
import {getApiBaseUrl} from '../config/api';
import type {
  AppRole,
  AuthSession,
  RegisterResult,
  UserProfile,
  WorkerType,
} from '../types/app';

const SESSION_FILE = `${RNFS.DocumentDirectoryPath}/diabetescare_v4_session.json`;
const SAVED_CREDS_FILE = `${RNFS.DocumentDirectoryPath}/diabetescare_saved_creds.json`;

let memorySession: AuthSession | null = null;

function mapApiUser(raw: any): UserProfile {
  const rawRole = String(raw?.role || 'field_worker').toLowerCase();
  const role: AppRole =
    rawRole === 'doctor' ||
    rawRole === 'field_worker' ||
    rawRole === 'moderator' ||
    rawRole === 'admin' ||
    rawRole === 'patient'
      ? rawRole
      : rawRole === 'asha' || rawRole === 'data_collector'
      ? 'field_worker'
      : rawRole === 'hospital_admin'
      ? 'admin'
      : 'field_worker';

  return {
    userId: String(raw?.user_id || raw?.id || ''),
    fullName:
      raw?.full_name ||
      raw?.name ||
      raw?.username ||
      raw?.email ||
      raw?.phone ||
      'User',
    email: raw?.email || undefined,
    phone: raw?.phone || undefined,
    username: raw?.username || undefined,
    workerId: raw?.worker_id || undefined,
    role,
    workerType: raw?.worker_type
      ? (String(raw.worker_type).toUpperCase() as WorkerType)
      : undefined,
    district: raw?.district || undefined,
    specialization: raw?.specialization || undefined,
    status: raw?.status || (raw?.is_active === false ? 'suspended' : 'active'),
    isActive: raw?.status ? raw.status === 'active' : raw?.is_active !== false,
  };
}

export async function saveAuthSession(session: AuthSession | null): Promise<void> {
  memorySession = session;
  try {
    if (!session) {
      const exists = await RNFS.exists(SESSION_FILE);
      if (exists) {
        await RNFS.unlink(SESSION_FILE);
      }
      return;
    }
    await RNFS.writeFile(SESSION_FILE, JSON.stringify(session), 'utf8');
  } catch {
    // Keep memorySession even if disk write fails.
  }
}

export async function getAuthSession(): Promise<AuthSession | null> {
  if (memorySession) {
    return memorySession;
  }
  try {
    const exists = await RNFS.exists(SESSION_FILE);
    if (!exists) {
      return null;
    }
    const raw = await RNFS.readFile(SESSION_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed?.token && parsed?.user?.userId) {
      memorySession = parsed;
      return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return null;
}

export async function getAuthToken(): Promise<string | null> {
  const s = await getAuthSession();
  return s?.token || null;
}

export async function logoutV4(): Promise<void> {
  await saveAuthSession(null);
}

export async function saveLoginCredentials(
  role: AppRole,
  identifier: string,
  password: string,
): Promise<void> {
  try {
    let map: Record<string, {identifier: string; password: string}> = {};
    if (await RNFS.exists(SAVED_CREDS_FILE)) {
      const raw = await RNFS.readFile(SAVED_CREDS_FILE, 'utf8');
      map = JSON.parse(raw) || {};
    }
    map[role] = {identifier, password};
    await RNFS.writeFile(SAVED_CREDS_FILE, JSON.stringify(map), 'utf8');
  } catch {
    // ignore
  }
}

export async function getSavedLoginCredentials(
  role: AppRole,
): Promise<{identifier: string; password: string} | null> {
  try {
    if (!(await RNFS.exists(SAVED_CREDS_FILE))) {
      return null;
    }
    const raw = await RNFS.readFile(SAVED_CREDS_FILE, 'utf8');
    const map = JSON.parse(raw) || {};
    return map[role] || null;
  } catch {
    return null;
  }
}

export function getHomeRouteForRole(
  role: AppRole,
):
  | 'DoctorHome'
  | 'FieldWorkerHome'
  | 'ModeratorHome'
  | 'AdminHome'
  | 'DoctorCommandHub' {
  switch (role) {
    case 'doctor':
      return 'DoctorHome';
    case 'field_worker':
      return 'FieldWorkerHome';
    case 'moderator':
      return 'ModeratorHome';
    case 'admin':
      return 'AdminHome';
    case 'patient':
      return 'DoctorCommandHub';
  }
}

export function getHomeParamsForRole(user: UserProfile): any {
  if (user.role === 'patient') {
    return {
      userRole: 'patient',
      userProfile: {
        role: 'patient',
        name: user.fullName,
        title: 'Registered Cohort Patient',
        badge: 'Patient Portal',
        badgeColor: '#10B981',
        description:
          'Longitudinal wound journey, clinical prescriptions & teleconsultation.',
        icon: '🩹',
        mrnOrId: user.workerId || user.userId,
        facility: user.district || 'Kharagpur Rural · Paschim Medinipur',
      },
    };
  }
  return undefined;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') {
      return body.detail;
    }
    if (typeof body?.message === 'string') {
      return body.message;
    }
    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch {
    // ignore
  }
  return `Request failed (HTTP ${res.status})`;
}

export interface RegisterV4Params {
  fullName: string;
  email?: string;
  phone?: string;
  username?: string;
  workerId?: string;
  password: string;
  role: AppRole;
  workerType?: WorkerType;
  district?: string;
  specialization?: string;
}

export async function loginWithIdentifier(
  identifier: string,
  password: string,
  roleHint?: AppRole,
): Promise<AuthSession> {
  const trimmed = identifier.trim();
  const baseUrl = getApiBaseUrl();
  const body: Record<string, unknown> = {
    identifier: trimmed,
    password,
  };
  if (roleHint) {
    body.role = roleHint;
  }

  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }

  const json = await res.json();
  const payload = json?.data ?? json;
  const token = payload?.token || payload?.access_token;
  if (!token) {
    throw new Error('Server did not return an access token.');
  }

  const user = mapApiUser(payload?.user || payload);
  const session: AuthSession = {token, user};
  await saveAuthSession(session);
  await saveLoginCredentials(user.role, trimmed, password);
  return session;
}

export async function registerUserV4(
  params: RegisterV4Params,
): Promise<RegisterResult> {
  const baseUrl = getApiBaseUrl();
  const payload: Record<string, unknown> = {
    full_name: params.fullName.trim(),
    password: params.password,
    role: params.role,
  };
  if (params.email?.trim()) {
    payload.email = params.email.trim();
  }
  if (params.phone?.trim()) {
    payload.phone = params.phone.trim();
  }
  if (params.username?.trim()) {
    payload.username = params.username.trim();
  }
  if (params.workerId?.trim()) {
    payload.worker_id = params.workerId.trim();
  }
  if (params.role === 'field_worker') {
    payload.worker_type = params.workerType || 'ASHA';
    if (params.district?.trim()) {
      payload.district = params.district.trim();
    }
  }
  if (params.role === 'doctor' && params.specialization?.trim()) {
    payload.specialization = params.specialization.trim();
  }

  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });

  if (!regRes.ok) {
    throw new Error(await parseErrorMessage(regRes));
  }

  const regJson = await regRes.json();
  const regData = regJson?.data ?? regJson;
  const user = mapApiUser(regData?.user || regData);
  const directToken = regData?.token || regData?.access_token;
  const isPending =
    Boolean(regData?.pending_approval) ||
    regJson?.status === 'pending' ||
    regData?.status === 'pending' ||
    user.status === 'pending' ||
    !directToken;

  if (isPending) {
    return {
      pendingApproval: true,
      status: String(regData?.status || regJson?.status || 'pending'),
      message:
        regData?.message ||
        'Account submitted for Admin verification. You can sign in once approved by an Administrator.',
      user,
    };
  }

  const session: AuthSession = {token: directToken, user};
  await saveAuthSession(session);
  const savedIdent =
    params.username?.trim() ||
    params.workerId?.trim() ||
    params.email?.trim() ||
    params.phone?.trim() ||
    user.workerId ||
    user.email ||
    '';
  if (savedIdent) {
    await saveLoginCredentials(user.role, savedIdent, params.password);
  }
  return {
    pendingApproval: false,
    status: 'active',
    session,
    user,
  };
}

export async function fetchCurrentProfile(): Promise<UserProfile | null> {
  const token = await getAuthToken();
  if (!token) {
    return null;
  }
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
      headers: {Authorization: `Bearer ${token}`},
    });
    if (!res.ok) {
      return null;
    }
    const raw = await res.json();
    const user = mapApiUser(raw?.data ?? raw);
    await saveAuthSession({token, user});
    return user;
  } catch {
    return null;
  }
}

// ── Legacy exports kept for existing screens ──────────────────────────────────
export type AuthTokens = {
  token: string;
  refresh_token: string;
  user_id: string;
  role: string;
};

export async function registerWithServer(
  phone: string,
  password: string,
  fullName: string,
  role: AppRole | 'asha' | 'patient',
): Promise<AuthTokens | null> {
  try {
    const mappedRole: AppRole =
      role === 'asha' || role === 'patient' ? 'field_worker' : role;
    const res = await registerUserV4({
      phone,
      password,
      fullName,
      role: mappedRole,
    });
    if (!res.session || res.pendingApproval) {
      return null;
    }
    return {
      token: res.session.token,
      refresh_token: '',
      user_id: res.session.user.userId,
      role: res.session.user.role,
    };
  } catch {
    return null;
  }
}

export async function loginWithServer(
  phone: string,
  password: string,
  role?: AppRole | 'asha' | 'patient',
): Promise<AuthTokens | null> {
  try {
    const mappedRole: AppRole | undefined =
      role === 'asha' || role === 'patient' ? 'field_worker' : role;
    const session = await loginWithIdentifier(phone, password, mappedRole);
    return {
      token: session.token,
      refresh_token: '',
      user_id: session.user.userId,
      role: session.user.role,
    };
  } catch {
    return null;
  }
}

export async function loginAshaWithServer(
  workerId: string,
  pin: string,
): Promise<AuthTokens | null> {
  return loginWithServer(workerId, pin, 'field_worker');
}

export async function logoutServer() {
  await logoutV4();
}
