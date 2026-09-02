export type TeleconsultRequestType = 'URGENT' | 'ROUTINE' | 'FOLLOW_UP';

export type TeleconsultStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';

export type TeleconsultPrescription = {
  diagnosis?: string;
  medications?: unknown;
  wound_care_instructions_en?: string;
  wound_care_instructions_bn?: string;
  dressing_instructions?: string;
  referral_required?: boolean;
  referral_details?: string;
  valid_until?: string;
};

export type TeleconsultSummary = {
  id: string;
  status: TeleconsultStatus;
  request_type: TeleconsultRequestType;
  session_id?: string | null;
  alert_id?: string | null;
  patient_concern_en?: string | null;
  patient_concern_bn?: string | null;
  preferred_callback_time?: string | null;
  estimated_callback_time?: string | null;
  scheduled_callback_time?: string | null;
  assigned_doctor_name?: string | null;
  doctor_calling_number?: string | null;
  can_cancel?: boolean;
  requested_at?: string | null;
  patient_rating?: number | null;
  patient_feedback?: string | null;
  prescription?: TeleconsultPrescription | null;
};
