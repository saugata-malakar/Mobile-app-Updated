export type AshaCommissionType =
  | 'PATIENT_REGISTRATION'
  | 'RESEARCH_SCREENING'
  | 'MONITORING_SUBMISSION'
  | 'COMMERCIAL_ENROLMENT'
  | 'QUALITY_BONUS'
  | 'MONTHLY_RETENTION_BONUS';

export type AshaCommissionBreakdownRow = {
  commission_type: AshaCommissionType | string;
  amount_rs: number;
  count?: number;
};

export type AshaCommissionHistoryRow = {
  id?: string;
  commission_type: AshaCommissionType | string;
  amount_rs: number;
  earned_at: string;
  payment_status?: string;
};

export type AshaCommissionsApiResponse = {
  total_earned: number;
  pending: number;
  paid: number;
  breakdown: AshaCommissionBreakdownRow[];
  history?: AshaCommissionHistoryRow[];
  payment_history?: {paid_at: string; amount_rs: number; reference?: string}[];
};

export type OfflineQueueKind = 'photograph' | 'session' | 'registration' | 'other';
