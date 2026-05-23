import NetInfo from '@react-native-community/netinfo';
import {api} from './apiClient';
import {enqueueRequest} from './offlineQueue';

export type SubmissionMethod = 'ASHA_ASSISTED' | 'PATIENT_SELF';

export type CreateMonitoringSessionBody = {
  patient_id: string;
  wound_site_id: string;
  submission_method: SubmissionMethod;
  session_type?: string;
  photograph_count?: number;
};

export type CreateMonitoringSessionResult = {
  sessionId: string;
  queued: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  primaryFinding: string;
  recommendedAction: string;
  referralRequired: boolean;
};

function demoAiFromSlots(slots: {quality: number}[]): {
  riskLevel: 'low' | 'medium' | 'high';
  primaryFinding: string;
  recommendedAction: string;
  referralRequired: boolean;
} {
  const lowQ = slots.some(s => s.quality < 50);
  const midQ = slots.some(s => s.quality < 70);
  if (lowQ) {
    return {
      riskLevel: 'high',
      primaryFinding: 'Wound needs clinical review — image quality or appearance concern',
      recommendedAction: 'Refer to PHC within 24–48 hours',
      referralRequired: true,
    };
  }
  if (midQ) {
    return {
      riskLevel: 'medium',
      primaryFinding: 'Monitor closely; possible slough or delayed healing',
      recommendedAction: 'Counsel patient; PHC visit if not improving in 3 days',
      referralRequired: false,
    };
  }
  return {
    riskLevel: 'low',
    primaryFinding: 'Stable appearance this week',
    recommendedAction: 'Continue dressing plan; next photo in 7 days',
    referralRequired: false,
  };
}

/**
 * POST /api/v1/sessions — queues when offline (A12).
 */
export async function submitMonitoringSession(
  body: CreateMonitoringSessionBody,
  slots: {angle: string; quality: number}[],
  patientName: string,
): Promise<CreateMonitoringSessionResult> {
  const ai = demoAiFromSlots(slots);
  const payload = {
    ...body,
    session_type: body.session_type ?? 'WOUND_MONITOR',
    photograph_count: body.photograph_count ?? slots.length,
    ai_risk_level: ai.riskLevel,
  };
  const path = '/api/v1/sessions';
  const net = await NetInfo.fetch();
  const sessionId = `sess_${Date.now().toString(36)}`;

  if (net.isConnected) {
    try {
      const res = await api.post(path, payload);
      const sid = res.data?.data?.session?.id ?? res.data?.data?.session_id ?? sessionId;
      return {
        sessionId: String(sid),
        queued: false,
        ...ai,
      };
    } catch {
      // queue below
    }
  }

  await enqueueRequest('POST', path, payload, {
    queueKind: 'session',
    patientId: body.patient_id,
    patientName,
  });

  return {
    sessionId,
    queued: true,
    ...ai,
  };
}
