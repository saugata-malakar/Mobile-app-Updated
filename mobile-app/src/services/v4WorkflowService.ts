import {getApiBaseUrl} from '../config/api';
import type {
  AdminStats,
  AdminUserItem,
  CapturedPhoto,
  ClinicalNoteDraft,
  MedicalReportFile,
  PatientDetailsDraft,
  PaymentItem,
  SubmissionPhotoItem,
  SubmissionRecord,
} from '../types/app';
import {getAuthSession, getAuthToken} from './authService';

async function authHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {...(extra || {})};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {detail: text};
  }
  if (!res.ok) {
    const msg =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (data?.data !== undefined ? data.data : data) as T;
}

export function resolvePhotoUri(photo?: Partial<SubmissionPhotoItem> | null): string | null {
  if (!photo) {
    return null;
  }
  if (photo.photo_data) {
    return photo.photo_data.startsWith('data:')
      ? photo.photo_data
      : `data:image/jpeg;base64,${photo.photo_data}`;
  }
  const url = photo.annotated_url || photo.file_url;
  if (!url) {
    return null;
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = getApiBaseUrl();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function pingServerHealth(customUrl?: string): Promise<boolean> {
  const target = (customUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, 4000);
  try {
    const res = await fetch(`${target}/health`, {signal: controller.signal});
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export async function createSubmission(
  details: PatientDetailsDraft,
): Promise<SubmissionRecord> {
  const session = await getAuthSession();
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(`${getApiBaseUrl()}/api/v1/submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      patient_id:
        details.isFollowup && details.patientId?.trim()
          ? details.patientId.trim()
          : undefined,
      patient_name: details.patientName.trim() || 'Unnamed Patient',
      patient_age: details.age,
      patient_weight_kg: details.weightKg,
      patient_bp_systolic: details.bpSystolic,
      patient_bp_diastolic: details.bpDiastolic,
      bp_systolic: details.bpSystolic,
      bp_diastolic: details.bpDiastolic,
      patient_blood_sugar: details.bloodSugar,
      blood_sugar: details.bloodSugar,
      patient_comorbidities: details.comorbidities,
      comorbidities: details.comorbidities,
      district: details.district || session?.user.district || undefined,
      is_followup: details.isFollowup,
      submitted_by_user_id: session?.user.userId,
      submitter_role: session?.user.role,
      worker_type: session?.user.workerType,
    }),
  });
  return parseJsonOrThrow<SubmissionRecord>(res);
}

export async function uploadSubmissionPhoto(
  submissionId: string,
  photo: CapturedPhoto,
): Promise<{
  photo_id?: string;
  file_url?: string;
  annotated_url?: string;
  quality_passed?: boolean;
  blur_score?: number;
  coin_detected?: boolean;
  message?: string;
}> {
  const baseUrl = getApiBaseUrl();
  if (photo.base64) {
    const headers = await authHeaders({'Content-Type': 'application/json'});
    const res = await fetch(`${baseUrl}/api/v1/submissions/${submissionId}/photos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        photo_number: photo.photoNumber,
        photo_type: photo.photoType,
        image_base64: photo.base64,
      }),
    });
    return parseJsonOrThrow(res);
  }

  const headers = await authHeaders();
  const form = new FormData();
  form.append('photo_number', String(photo.photoNumber));
  form.append('photo_type', photo.photoType);
  form.append('file', {
    uri: photo.uri,
    type: photo.mimeType || 'image/jpeg',
    name: photo.fileName || `photo_${photo.photoNumber}.jpg`,
  } as any);

  const res = await fetch(`${baseUrl}/api/v1/submissions/${submissionId}/photos`, {
    method: 'POST',
    headers,
    body: form,
  });
  return parseJsonOrThrow(res);
}

export async function uploadSubmissionReport(
  submissionId: string,
  report: MedicalReportFile,
): Promise<{report_id?: string; file_url?: string; file_name?: string}> {
  const baseUrl = getApiBaseUrl();
  if (report.base64) {
    const headers = await authHeaders({'Content-Type': 'application/json'});
    const res = await fetch(`${baseUrl}/api/v1/submissions/${submissionId}/reports`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        file_base64: report.base64,
        file_name: report.fileName || 'medical_report.jpg',
        file_type: report.mimeType || 'image/jpeg',
      }),
    });
    return parseJsonOrThrow(res);
  }

  const headers = await authHeaders();
  const form = new FormData();
  form.append('file', {
    uri: report.uri,
    type: report.mimeType || 'image/jpeg',
    name: report.fileName || 'medical_report.jpg',
  } as any);

  const res = await fetch(`${baseUrl}/api/v1/submissions/${submissionId}/reports`, {
    method: 'POST',
    headers,
    body: form,
  });
  return parseJsonOrThrow(res);
}

export async function addClinicalNote(
  submissionId: string,
  note: ClinicalNoteDraft,
): Promise<void> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/submissions/${submissionId}/clinical-note`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        diagnosis: note.diagnosis,
        severity: note.severity || undefined,
        treatment_needed: note.treatmentNeeded || undefined,
        medication: note.medication || undefined,
      }),
    },
  );
  await parseJsonOrThrow(res);
}

export async function submitForAiCheck(
  submissionId: string,
): Promise<SubmissionRecord> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/submissions/${submissionId}/submit`,
    {
      method: 'POST',
      headers,
    },
  );
  return parseJsonOrThrow<SubmissionRecord>(res);
}

export async function getMySubmissions(): Promise<SubmissionRecord[]> {
  const session = await getAuthSession();
  const headers = await authHeaders();
  const qs = session?.user.userId
    ? `?user_id=${encodeURIComponent(session.user.userId)}`
    : '';
  const res = await fetch(`${getApiBaseUrl()}/api/v1/submissions/my${qs}`, {
    headers,
  });
  const data = await parseJsonOrThrow<{submissions: SubmissionRecord[]}>(res);
  return data.submissions || [];
}

export async function getSubmissionDetail(
  submissionId: string,
): Promise<SubmissionRecord> {
  const headers = await authHeaders();
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/submissions/${submissionId}`,
    {headers},
  );
  return parseJsonOrThrow<SubmissionRecord>(res);
}

export async function getMyPayments(): Promise<{
  payments: PaymentItem[];
  total_earned: number;
  total_pending: number;
}> {
  const session = await getAuthSession();
  const headers = await authHeaders();
  const qs = session?.user.userId
    ? `?user_id=${encodeURIComponent(session.user.userId)}`
    : '';
  const res = await fetch(`${getApiBaseUrl()}/api/v1/payments/my${qs}`, {headers});
  return parseJsonOrThrow(res);
}

// ── Moderator APIs ────────────────────────────────────────────────────────────
export async function getModeratorQueue(
  status?: 'all' | 'ai_reviewed' | 'moderator_approved' | 'moderator_rejected',
): Promise<SubmissionRecord[]> {
  const headers = await authHeaders();
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${getApiBaseUrl()}/api/v1/moderator/queue${qs}`, {
    headers,
  });
  const data = await parseJsonOrThrow<{queue: SubmissionRecord[]}>(res);
  return data.queue || [];
}

export async function approveModeratorSubmission(
  submissionId: string,
  note?: string,
): Promise<SubmissionRecord> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/moderator/${submissionId}/approve`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(note ? {note} : {}),
    },
  );
  return parseJsonOrThrow<SubmissionRecord>(res);
}

export async function rejectModeratorSubmission(
  submissionId: string,
  reason: string,
): Promise<SubmissionRecord> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/moderator/${submissionId}/reject`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({reason}),
    },
  );
  return parseJsonOrThrow<SubmissionRecord>(res);
}

// ── Doctor Queue APIs ─────────────────────────────────────────────────────────
export async function getDoctorQueue(): Promise<SubmissionRecord[]> {
  const headers = await authHeaders();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/doctor/queue`, {headers});
  const data = await parseJsonOrThrow<{queue: SubmissionRecord[]}>(res);
  return data.queue || [];
}

export async function validateDoctorSubmission(
  submissionId: string,
  note: ClinicalNoteDraft,
): Promise<SubmissionRecord> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/doctor/${submissionId}/validate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        diagnosis: note.diagnosis,
        severity: note.severity || undefined,
        treatment_needed: note.treatmentNeeded || undefined,
        medication: note.medication || undefined,
      }),
    },
  );
  return parseJsonOrThrow<SubmissionRecord>(res);
}

// ── Admin APIs ────────────────────────────────────────────────────────────────
export async function getAdminStats(): Promise<AdminStats> {
  const headers = await authHeaders();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/stats`, {headers});
  return parseJsonOrThrow<AdminStats>(res);
}

export async function getAdminUsers(
  role?: string,
  search?: string,
): Promise<AdminUserItem[]> {
  const headers = await authHeaders();
  const params: string[] = [];
  if (role) {
    params.push(`role=${encodeURIComponent(role)}`);
  }
  if (search) {
    params.push(`search=${encodeURIComponent(search)}`);
  }
  const qs = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users${qs}`, {
    headers,
  });
  const data = await parseJsonOrThrow<{users: AdminUserItem[]}>(res);
  return data.users || [];
}

export async function updateAdminUser(
  userId: string,
  updates: {status?: 'active' | 'suspended'; role?: string; district?: string},
): Promise<AdminUserItem> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users/${userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  });
  return parseJsonOrThrow<AdminUserItem>(res);
}

export async function getAdminSubmissions(
  status?: string,
  submitterRole?: string,
  search?: string,
): Promise<SubmissionRecord[]> {
  const headers = await authHeaders();
  const params: string[] = [];
  if (status) {
    params.push(`status=${encodeURIComponent(status)}`);
  }
  if (submitterRole) {
    params.push(`role=${encodeURIComponent(submitterRole)}`);
    params.push(`submitter_role=${encodeURIComponent(submitterRole)}`);
  }
  if (search) {
    params.push(`search=${encodeURIComponent(search)}`);
  }
  const qs = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/submissions${qs}`, {
    headers,
  });
  const data = await parseJsonOrThrow<{submissions: SubmissionRecord[]}>(res);
  return data.submissions || [];
}

export async function overrideAdminSubmission(
  submissionId: string,
  decision: 'accepted' | 'rejected',
  reason?: string,
): Promise<SubmissionRecord> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/admin/submissions/${submissionId}/override`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({status: decision, reason: reason || undefined}),
    },
  );
  return parseJsonOrThrow<SubmissionRecord>(res);
}

export async function getAdminPayments(
  role?: string,
  status?: string,
): Promise<PaymentItem[]> {
  const headers = await authHeaders();
  const params: string[] = [];
  if (role) {
    params.push(`role=${encodeURIComponent(role)}`);
  }
  if (status) {
    params.push(`status=${encodeURIComponent(status)}`);
  }
  const qs = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/payments${qs}`, {
    headers,
  });
  const data = await parseJsonOrThrow<{payments: PaymentItem[]}>(res);
  return data.payments || [];
}

export async function markAdminPaymentPaid(
  paymentId: string,
): Promise<PaymentItem> {
  const headers = await authHeaders({'Content-Type': 'application/json'});
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/admin/payments/${paymentId}/mark-paid`,
    {
      method: 'POST',
      headers,
    },
  );
  return parseJsonOrThrow<PaymentItem>(res);
}

export async function getAdminRates(): Promise<Record<string, number>> {
  const headers = await authHeaders();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/rates`, {headers});
  const data = await parseJsonOrThrow<{rates?: Record<string, number>}>(res);
  return (data.rates || data) as Record<string, number>;
}
