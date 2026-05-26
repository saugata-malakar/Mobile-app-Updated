import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppRole,
  AshaStats,
  PatientProfile,
  ScreeningRecord,
  Session,
} from '../types/app';

const SESSION = '@hs/session';
const PATIENT_CREDS = '@hs/patient_accounts';
const ASHA_CREDS = '@hs/asha_accounts';
const PREFIX_PROFILE_SELF = '@hs/patient_self_profile_';
const PREFIX_ASHA_PATIENTS = '@hs/asha_patients_';
const PREFIX_ASHA_SCREENINGS = '@hs/asha_screenings_';
const PREFIX_ASHA_STATS = '@hs/asha_stats_';

function keyPatientSelf(phone: string) {
  return `${PREFIX_PROFILE_SELF}${normalizePhone(phone)}`;
}

function keyAshaPatients(ashaPhone: string) {
  return `${PREFIX_ASHA_PATIENTS}${normalizePhone(ashaPhone)}`;
}

function keyAshaScreenings(ashaPhone: string) {
  return `${PREFIX_ASHA_SCREENINGS}${normalizePhone(ashaPhone)}`;
}

function keyAshaStats(ashaPhone: string) {
  return `${PREFIX_ASHA_STATS}${normalizePhone(ashaPhone)}`;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, '').trim();
}

function genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

type CredStore = Record<string, {pin: string; displayName: string}>;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getSession(): Promise<Session | null> {
  return readJson<Session | null>(SESSION, null);
}

export async function setSession(session: Session | null) {
  if (!session) {
    await AsyncStorage.removeItem(SESSION);
    return;
  }
  await writeJson(SESSION, session);
}

export async function logout() {
  await setSession(null);
  try {
    const {logoutServer} = await import('../services/authService');
    await logoutServer();
  } catch {
    // ignore
  }
}

async function getCreds(mapKey: string): Promise<CredStore> {
  return readJson<CredStore>(mapKey, {});
}

/** Backend seed + demo UI: asha001/1234, asha002/1234 (see backend/app.py). */
export async function ensureDemoAshaAccounts() {
  const map = await getCreds(ASHA_CREDS);
  const demos: Record<string, {pin: string; displayName: string}> = {
    asha001: {pin: '1234', displayName: 'ASHA Demo Worker'},
    asha002: {pin: '1234', displayName: 'ASHA Worker Two'},
  };
  let changed = false;
  for (const [id, row] of Object.entries(demos)) {
    if (!map[id]) {
      map[id] = row;
      changed = true;
    }
  }
  if (changed) {
    await writeJson(ASHA_CREDS, map);
  }
}

export async function registerAccount(
  role: AppRole,
  phone: string,
  pin: string,
  displayName: string,
) {
  const p = normalizePhone(phone);
  const map = role === 'patient' ? PATIENT_CREDS : ASHA_CREDS;
  const creds = await getCreds(map);
  if (creds[p]) {
    throw new Error('Account already exists for this phone.');
  }
  creds[p] = {pin, displayName};
  await writeJson(map, creds);
}

export async function loginAccount(
  role: AppRole,
  phone: string,
  pin: string,
): Promise<Session> {
  const p = normalizePhone(phone);
  const map = role === 'patient' ? PATIENT_CREDS : ASHA_CREDS;
  const creds = await getCreds(map);
  const row = creds[p];
  if (!row || row.pin !== pin) {
    throw new Error('Invalid phone or PIN.');
  }
  return {role, phone: p, displayName: row.displayName};
}

export async function getPatientSelfProfile(
  phone: string,
): Promise<PatientProfile | null> {
  const key = keyPatientSelf(phone);
  return readJson<PatientProfile | null>(key, null);
}

export async function savePatientSelfProfile(profile: PatientProfile) {
  const key = keyPatientSelf(profile.phone);
  await writeJson(key, profile);
}

export async function deletePatientSelfProfile(phone: string) {
  await AsyncStorage.removeItem(keyPatientSelf(phone));
}

export async function listAshaPatients(
  ashaPhone: string,
): Promise<PatientProfile[]> {
  const key = keyAshaPatients(ashaPhone);
  return readJson<PatientProfile[]>(key, []);
}

export async function upsertAshaPatient(
  ashaPhone: string,
  profile: PatientProfile,
) {
  const key = keyAshaPatients(ashaPhone);
  const list = await listAshaPatients(ashaPhone);
  const idx = list.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    list[idx] = profile;
  } else {
    list.push(profile);
  }
  await writeJson(key, list);
}

export async function getAshaPatient(
  ashaPhone: string,
  patientId: string,
): Promise<PatientProfile | null> {
  const list = await listAshaPatients(ashaPhone);
  return list.find(p => p.id === patientId) ?? null;
}

export async function listAshaScreenings(
  ashaPhone: string,
): Promise<ScreeningRecord[]> {
  const key = keyAshaScreenings(ashaPhone);
  return readJson<ScreeningRecord[]>(key, []);
}

async function bumpAshaStats(
  ashaPhone: string,
  deltaScreenings: number,
) {
  const key = keyAshaStats(ashaPhone);
  const cur = await readJson<AshaStats>(key, {
    patientCount: 0,
    screeningCount: 0,
  });
  cur.screeningCount += deltaScreenings;
  const patients = await listAshaPatients(ashaPhone);
  cur.patientCount = patients.length;
  await writeJson(key, cur);
}

export async function getAshaStats(ashaPhone: string): Promise<AshaStats> {
  const key = keyAshaStats(ashaPhone);
  const patients = await listAshaPatients(ashaPhone);
  const stored = await readJson<AshaStats | null>(key, null);
  if (!stored) {
    return {
      patientCount: patients.length,
      screeningCount: 0,
    };
  }
  return {
    ...stored,
    patientCount: patients.length,
  };
}

export async function recordScreeningCompleted(args: {
  mode: AppRole;
  patientId: string;
  patientName: string;
  conditionKey?: string;
  riskLevel: 'low' | 'medium' | 'high';
  ashaWorkerPhone?: string;
  followUp: boolean;
}) {
  const rec: ScreeningRecord = {
    id: genId(),
    patientId: args.patientId,
    patientName: args.patientName,
    conditionLabel: args.conditionKey,
    riskLevel: args.riskLevel,
    createdAt: Date.now(),
    mode: args.mode,
    ashaWorkerPhone: args.ashaWorkerPhone,
    followUp: args.followUp,
  };

  if (args.mode === 'asha' && args.ashaWorkerPhone) {
    const key = keyAshaScreenings(args.ashaWorkerPhone);
    const list = await listAshaScreenings(args.ashaWorkerPhone);
    list.unshift(rec);
    await writeJson(key, list);
    await bumpAshaStats(args.ashaWorkerPhone, 1);
  }

  return rec;
}
