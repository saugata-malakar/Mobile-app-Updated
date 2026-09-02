// mobile-app/src/services/api.ts
// Complete typed API client for DiabetesCare AI backend

import { Platform } from 'react-native';

// ── Base URL ───────────────────────────────────────────────────────────────
// Change this to your backend URL before testing
const BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'   // Android emulator → localhost
    : 'http://localhost:8000';  // iOS simulator / physical device (update IP)

const API = `${BASE_URL}/api/v1`;

// ── Types ──────────────────────────────────────────────────────────────────

export interface GuidanceResponse {
  ready: boolean;
  instructions: string[];
  distance_status: 'too_close' | 'too_far' | 'ok' | 'unknown';
  brightness_status: 'too_dark' | 'too_bright' | 'ok';
  sticker_status: 'not_found' | 'found';
  blur_status: 'blurry' | 'ok';
  progress_pct: number;
}

export interface PatientRegisterPayload {
  full_name: string;
  phone?: string;
  address?: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  district?: string;
  state?: string;
  diabetes_type: 'type1' | 'type2' | 'gestational' | 'unknown';
  diabetes_years?: number;
  hba1c?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  consents_granted: string[];
  registered_by?: string;
}

export interface PatientRegisterResponse {
  patient_id: string;
  message: string;
  consents_recorded: string[];
}

export interface VisitCreatePayload {
  patient_id: string;
  conducted_by?: string;
  location?: string;
  gps_lat?: number;
  gps_lon?: number;
  chief_complaint?: string;
  symptoms?: string[];
  symptom_duration_days?: number;
}

export interface VisitResponse {
  visit_id: string;
  patient_id: string;
  visit_number: number;
  visit_date: string;
  message: string;
}

export interface SubmitCapturePayload {
  capture_id: string;
  patient_id: string;
  visit_id: string;
  photo_type: string;
  pipeline_success: boolean;
  quality: {
    passed: boolean;
    status: string;
    blur_score?: number;
    brightness_mean?: number;
    failure_reason?: string;
    suggestions: string[];
  };
  calibration: {
    sticker_detected: boolean;
    method?: string;
    pixels_per_mm?: number;
    scale_confidence?: number;
    marker_id?: number;
    colour_corrected: boolean;
  };
  measurements: {
    done: boolean;
    length_mm?: number;
    width_mm?: number;
    area_cm2?: number;
    perimeter_mm?: number;
    confidence?: number;
    segmentation: string;
    mask_rle?: object;
  };
  images: {
    original?: string;    // base64
    corrected?: string;   // base64
    annotated?: string;   // base64
  };
  metadata: {
    patient_id: string;
    visit_id: string;
    photo_type: string;
    anatomical_location?: string;
    device_model?: string;
    device_os?: string;
    app_version?: string;
    gps_lat?: number;
    gps_lon?: number;
    operator_id?: string;
    captured_at?: string;
  };
  processing_time_ms?: number;
  errors: string[];
  warnings: string[];
}

export interface SubmitCaptureResponse {
  capture_id: string;
  photo_id: string;
  measurement_id?: string;
  stored: boolean;
  quality_passed: boolean;
  measurements_stored: boolean;
  ai_triggered: boolean;
  warnings: string[];
  message: string;
}

export interface DoctorCorrectionPayload {
  measurement_id: string;
  length_mm?: number;
  width_mm?: number;
  area_cm2?: number;
  perimeter_mm?: number;
  notes?: string;
  corrected_by: string;
}

export interface ProgressionResponse {
  patient_id: string;
  total_visits: number;
  healing_trend: 'healing' | 'stable' | 'deteriorating' | 'insufficient_data';
  trend_percent?: number;
  alert?: string;
  all_measurements: Array<{
    visit_number: number;
    visit_date: string;
    length_mm?: number;
    width_mm?: number;
    area_cm2?: number;
  }>;
  recommendation: string;
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function patch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── API calls ──────────────────────────────────────────────────────────────

export const DiabetesCareAPI = {

  /** Register a new patient */
  registerPatient: (payload: PatientRegisterPayload) =>
    post<PatientRegisterResponse>('/clinical/patient/register', payload),

  /** Create a new visit for existing patient */
  createVisit: (payload: VisitCreatePayload) =>
    post<VisitResponse>('/clinical/visit/create', payload),

  /** Get live viewfinder guidance from a JPEG frame */
  getGuidance: async (frameBase64: string): Promise<GuidanceResponse> => {
    const blob = await fetch(`data:image/jpeg;base64,${frameBase64}`)
      .then(r => r.blob());
    const form = new FormData();
    form.append('file', blob as any, 'frame.jpg');
    return postForm<GuidanceResponse>('/data-collection/guidance-check', form);
  },

  /** Submit complete capture payload */
  submitCapture: (payload: SubmitCapturePayload) =>
    post<SubmitCaptureResponse>('/data-collection/submit', payload),

  /** Process raw image server-side (alternative to local pipeline) */
  processLocal: async (
    imageBase64: string,
    patientId: string,
    visitId: string,
    photoType: string,
    anatomicalLocation?: string,
    operatorId?: string,
  ): Promise<SubmitCaptureResponse> => {
    const blob = await fetch(`data:image/jpeg;base64,${imageBase64}`)
      .then(r => r.blob());
    const form = new FormData();
    form.append('file', blob as any, 'capture.jpg');
    const url =
      `/data-collection/process-local` +
      `?patient_id=${patientId}&visit_id=${visitId}&photo_type=${photoType}` +
      (anatomicalLocation ? `&anatomical_location=${anatomicalLocation}` : '') +
      (operatorId ? `&operator_id=${operatorId}` : '');
    return postForm<SubmitCaptureResponse>(url, form);
  },

  /** Doctor correction of AI measurements */
  correctMeasurement: (payload: DoctorCorrectionPayload) =>
    patch<{ message: string; final_area_cm2?: number }>
      ('/clinical/measurement/correct', payload),

  /** Get wound progression for a patient */
  getProgression: (patientId: string) =>
    get<ProgressionResponse>(`/analytics/patient/${patientId}/progression`),

  /** Get all visits for a patient */
  getVisits: (patientId: string) =>
    get<{ visits: VisitResponse[] }>(`/clinical/patient/${patientId}/visits`),
};
