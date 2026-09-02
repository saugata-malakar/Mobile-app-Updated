import AsyncStorage from '@react-native-async-storage/async-storage';
import type {WoundZoneOption} from '../components/woundSiteTypes';

export type AshaPatientWoundSite = {
  id: string;
  patientId: string;
  label: string;
  foot_side: 'LEFT' | 'RIGHT';
  location_on_foot: string;
  active: boolean;
  createdAt: number;
};

const key = (patientId: string) => `@hs/asha_wound_sites_${patientId}`;

async function read(patientId: string): Promise<AshaPatientWoundSite[]> {
  const raw = await AsyncStorage.getItem(key(patientId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as AshaPatientWoundSite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function write(patientId: string, rows: AshaPatientWoundSite[]) {
  await AsyncStorage.setItem(key(patientId), JSON.stringify(rows));
}

export async function listActiveAshaPatientWoundSites(
  patientId: string,
): Promise<AshaPatientWoundSite[]> {
  const rows = await read(patientId);
  return rows.filter(r => r.active);
}

export async function addAshaPatientWoundSite(
  patientId: string,
  zone: WoundZoneOption,
  serverId?: string,
): Promise<AshaPatientWoundSite> {
  const rows = await read(patientId);
  const row: AshaPatientWoundSite = {
    id: serverId ?? `ws_${Date.now().toString(36)}`,
    patientId,
    label: zone.label,
    foot_side: zone.foot_side,
    location_on_foot: zone.location_on_foot,
    active: true,
    createdAt: Date.now(),
  };
  rows.push(row);
  await write(patientId, rows);
  return row;
}
