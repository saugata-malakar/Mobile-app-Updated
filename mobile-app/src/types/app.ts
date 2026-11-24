export type AppRole = 'doctor' | 'field_worker' | 'moderator' | 'admin';
export type WorkerType = 'ASHA' | 'ICDS' | 'CHO';

export interface UserProfile {
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  username?: string;
  workerId?: string;
  role: AppRole;
  workerType?: WorkerType;
  district?: string;
  specialization?: string;
  status?: string;
  isActive?: boolean;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

export interface PatientDetailsDraft {
  patientName: string;
  patientId?: string;
  age: number;
  weightKg: number;
  bpSystolic: number;
  bpDiastolic: number;
  bloodSugar: number;
  district?: string;
  comorbidities: string[];
  isFollowup: boolean;
}

export type PhotoAngleType = 'distant' | 'medium' | 'close';

export interface CapturedPhoto {
  photoNumber: 1 | 2 | 3;
  photoType: PhotoAngleType;
  uri: string;
  base64?: string;
  fileName: string;
  mimeType?: string;
  uploaded?: boolean;
  fileUrl?: string;
  annotatedUrl?: string;
  qualityPassed?: boolean;
  blurScore?: number;
  coinDetected?: boolean;
  aiMessage?: string;
}

export interface MedicalReportFile {
  id: string;
  fileName: string;
  uri: string;
  mimeType?: string;
  base64?: string;
  uploaded?: boolean;
  fileUrl?: string;
}

export interface ClinicalNoteDraft {
  diagnosis: string;
  severity?: string;
  treatmentNeeded?: string;
  medication?: string;
}

export interface SubmissionPhotoItem {
  photo_id: string;
  photo_number: number;
  photo_type: string;
  photo_data?: string;
  file_url?: string;
  annotated_url?: string;
  quality_passed?: boolean | number;
  blur_score?: number;
  brightness_mean?: number;
  coin_detected?: boolean | number;
  created_at?: string | null;
}

export interface SubmissionReportItem {
  report_id: string;
  file_name: string;
  file_data?: string;
  file_url?: string;
  file_type?: string;
  created_at?: string | null;
}

export interface ClinicalNoteItem {
  note_id?: string;
  doctor_user_id?: string;
  diagnosis: string;
  severity?: string | null;
  treatment_needed?: string | null;
  medication?: string | null;
  created_at?: string | null;
}

export interface ModeratorReviewItem {
  review_id?: string;
  moderator_user_id?: string;
  decision: string;
  rejection_reason?: string | null;
  created_at?: string | null;
}

export interface PaymentItem {
  payment_id: string;
  submission_id: string;
  user_id?: string;
  user_name?: string | null;
  role: string;
  amount: number;
  description?: string | null;
  status: string;
  paid_at?: string | null;
  date?: string | null;
  created_at?: string | null;
}

export interface SubmissionRecord {
  submission_id: string;
  patient_id: string;
  submitted_by_user_id: string;
  submitted_by_name?: string | null;
  submitter_role: string;
  worker_type?: string | null;
  district?: string | null;
  status: string;
  ai_quality_passed?: boolean | number | null;
  ai_quality_score?: number | null;
  ai_rejection_reason?: string | null;
  ai_wagner_grade?: number | null;
  ai_area_cm2?: number | null;
  moderator_id?: string | null;
  moderator_name?: string | null;
  moderator_decision?: string | null;
  moderator_note?: string | null;
  moderator_reviewed_at?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  diagnosis?: string | null;
  severity?: string | null;
  treatment_needed?: string | null;
  medication?: string | null;
  doctor_completed_at?: string | null;
  patient_name?: string | null;
  patient_age?: number | null;
  patient_weight_kg?: number | null;
  patient_bp_systolic?: number | null;
  patient_bp_diastolic?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  patient_blood_sugar?: number | null;
  blood_sugar?: number | null;
  patient_comorbidities?: string[] | null;
  comorbidities?: string[] | null;
  is_followup?: boolean | number;
  original_submission_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  photo_count?: number;
  photos?: SubmissionPhotoItem[];
  reports?: SubmissionReportItem[];
  clinical_notes?: ClinicalNoteItem[];
  moderator_reviews?: ModeratorReviewItem[];
  payments?: PaymentItem[];
}

export interface AdminUserItem {
  user_id: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  worker_id?: string | null;
  full_name?: string | null;
  role: string;
  worker_type?: string | null;
  district?: string | null;
  specialization?: string | null;
  status?: string | null;
  is_active?: boolean;
  created_at?: string | null;
}

export interface AdminStats {
  total_users: number;
  users_by_role: Record<string, number>;
  total_submissions: number;
  submissions_today?: number;
  today_submissions?: number;
  pending_moderator?: number;
  pending_doctor?: number;
  accepted_count?: number;
  rejected_count?: number;
  submissions_by_status: Record<string, number>;
  total_payments_amount?: number;
  total_payouts?: number;
  paid_payments_amount?: number;
  payouts_by_role?: Record<string, number>;
}

// ── Legacy types preserved for existing screens ───────────────────────────────
export type LegacyAppRole = 'asha' | 'patient';
export type Gender = 'male' | 'female' | 'other' | '';

export interface PatientProfile {
  id: string;
  fullName: string;
  age: string;
  gender: Gender;
  phone: string;
  address: string;
  village: string;
  emergencyContact: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  registeredAt: number;
}

export interface Session {
  role: AppRole | LegacyAppRole;
  phone: string;
  displayName: string;
}

export interface ScreeningRecord {
  id: string;
  patientId: string;
  patientName: string;
  conditionLabel?: string;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: number;
  mode: AppRole | LegacyAppRole;
  ashaWorkerPhone?: string;
  followUp: boolean;
}

export interface AshaStats {
  patientCount: number;
  screeningCount: number;
}
