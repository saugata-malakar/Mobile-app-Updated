import {Platform, Share} from 'react-native';
import RNFS from 'react-native-fs';

import {api} from './apiClient';

export type ReferralPdfPayload = {
  patient_id: string;
  patient_name: string;
  patient_age?: number;
  village?: string;
  phone?: string;
  risk_level: string;
  conditions: string[];
  recommendation?: string;
  diagnosis_code?: string;
  diagnosis_description?: string;
  specialist?: string;
  urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY' | string;
  asha_worker_name?: string;
  asha_id_number?: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(binary);
}

/**
 * POST server-side ReportLab PDF. Returns local file path suitable for Share.
 */
export async function downloadReferralPdfToCache(payload: ReferralPdfPayload): Promise<string> {
  const res = await api.post('/api/v1/asha/referrals/pdf', payload, {
    responseType: 'arraybuffer',
    headers: {Accept: 'application/pdf'},
  });
  const data = res.data as unknown as ArrayBuffer;
  const base64 = arrayBufferToBase64(data);
  const path = `${RNFS.CachesDirectoryPath}/referral_${Date.now()}.pdf`;
  await RNFS.writeFile(path, base64, 'base64');
  return path;
}

export async function shareReferralPdfFile(localPath: string, title?: string) {
  const url = Platform.OS === 'android' ? `file://${localPath}` : localPath;
  await Share.share(
    {
      title: title ?? 'PHC referral slip',
      message: title ?? 'Referral slip',
      url,
    },
    {subject: title ?? 'PHC referral slip'},
  );
}
