import NetInfo from '@react-native-community/netinfo';
import {api} from './apiClient';
import {enqueueRequest} from './offlineQueue';
import type {WoundZoneOption} from '../components/woundSiteTypes';
import {addAshaPatientWoundSite} from '../storage/ashaWoundSitesStorage';

export type WoundSitePayload = {
  foot_side: 'LEFT' | 'RIGHT';
  location_on_foot: 'HALLUX' | 'FOREFOOT' | 'MIDFOOT' | 'HEEL';
  first_detected_date: string;
};

export function zoneToPayload(zone: WoundZoneOption): WoundSitePayload {
  return {
    foot_side: zone.foot_side,
    location_on_foot: zone.location_on_foot,
    first_detected_date: new Date().toISOString().slice(0, 10),
  };
}

export type CreateWoundSiteResult = {
  id: string;
  label: string;
  queued: boolean;
};

/**
 * ASHA creates wound site on behalf of patient.
 * POST /api/v1/asha/patients/:id/wound-sites (queued when offline).
 */
export async function createAshaPatientWoundSite(
  patientId: string,
  patientName: string,
  zone: WoundZoneOption,
): Promise<CreateWoundSiteResult> {
  const body = zoneToPayload(zone);
  const path = `/api/v1/asha/patients/${patientId}/wound-sites`;
  const net = await NetInfo.fetch();

  if (net.isConnected) {
    try {
      const res = await api.post(path, body);
      const ws = res.data?.data?.wound_site;
      const id = ws?.id ?? `ws_${Date.now().toString(36)}`;
      await addAshaPatientWoundSite(patientId, zone, id);
      return {id, label: zone.label, queued: false};
    } catch {
      // fall through to queue
    }
  }

  await enqueueRequest('POST', path, body, {
    queueKind: 'registration',
    patientId,
    patientName,
  });
  const local = await addAshaPatientWoundSite(patientId, zone);
  return {id: local.id, label: zone.label, queued: true};
}
