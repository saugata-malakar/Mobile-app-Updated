export type AppRole = 'asha' | 'patient';

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
  role: AppRole;
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
  mode: AppRole;
  ashaWorkerPhone?: string;
  followUp: boolean;
}

export interface AshaStats {
  patientCount: number;
  screeningCount: number;
  totalCommissionINR: number;
}
