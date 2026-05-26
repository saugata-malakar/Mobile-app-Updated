import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PatientDashboardSnapshot,
  WoundSiteRecord,
} from '../types/patientDashboard';

const KEY = '@hs/patient_dashboard_v1';

const defaultSnapshot = (): PatientDashboardSnapshot => ({
  woundSites: [
    {
      id: 'ws_demo_1',
      label: 'Left heel',
      side: 'L',
      zone: 'heel',
      active: true,
      lastSessionDate: new Date(Date.now() - 86400000 * 2).toISOString(),
      lastDot: 'amber',
      overdueDays: 0,
      sessionDueToday: true,
    },
  ],
  tasks: [
    {
      id: 't1',
      moduleName: 'Wound photograph',
      woundSiteLabel: 'Left heel',
      wound_site_id: 'ws_demo_1',
      dueDate: new Date().toISOString(),
      overdue: false,
      urgent: false,
    },
    {
      id: 't2',
      moduleName: 'Skin assessment',
      dueDate: new Date(Date.now() - 86400000).toISOString(),
      overdue: true,
      urgent: false,
    },
  ],
  alerts: [
    {
      id: 'a1',
      level: 'amber',
      title: 'Healing slowed',
      summary: 'Area change below expected for this week.',
      createdAt: new Date().toISOString(),
      resolved: false,
    },
  ],
  teleconsult: {
    doctorName: 'Dr. Example Sen',
    scheduledIso: new Date(Date.now() + 86400000 * 2).toISOString(),
    callingNumber: '+91-80-0000-0000',
    teleconsultId: undefined,
  },
});

async function read(): Promise<PatientDashboardSnapshot> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    const snap = defaultSnapshot();
    await AsyncStorage.setItem(KEY, JSON.stringify(snap));
    return snap;
  }
  try {
    return JSON.parse(raw) as PatientDashboardSnapshot;
  } catch {
    const snap = defaultSnapshot();
    await AsyncStorage.setItem(KEY, JSON.stringify(snap));
    return snap;
  }
}

async function write(s: PatientDashboardSnapshot) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export async function getPatientDashboard(): Promise<PatientDashboardSnapshot> {
  return read();
}

export async function addWoundSite(site: Omit<WoundSiteRecord, 'id'>): Promise<WoundSiteRecord> {
  const s = await read();
  const id = `ws_${Date.now().toString(36)}`;
  const row: WoundSiteRecord = {...site, id};
  s.woundSites.push(row);
  await write(s);
  return row;
}

export async function replaceDashboard(next: PatientDashboardSnapshot) {
  await write(next);
}
