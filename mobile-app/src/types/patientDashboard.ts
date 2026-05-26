export type WoundDot = 'green' | 'amber' | 'red';

export type WoundSiteRecord = {
  id: string;
  label: string;
  side: 'L' | 'R';
  zone: string;
  active: boolean;
  lastSessionDate?: string | null;
  lastDot: WoundDot;
  /** Days overdue for next photo; 0 if not overdue */
  overdueDays: number;
  sessionDueToday: boolean;
};

export type ScheduledTask = {
  id: string;
  moduleName: string;
  woundSiteLabel?: string;
  /** When set, wound tasks can open the correct site session guide. */
  wound_site_id?: string;
  dueDate: string;
  overdue: boolean;
  urgent: boolean;
};

export type PatientAlert = {
  id: string;
  level: 'amber' | 'red';
  title: string;
  summary: string;
  createdAt: string;
  resolved: boolean;
};

export type UpcomingTeleconsult = {
  doctorName: string;
  scheduledIso: string;
  callingNumber: string;
  teleconsultId?: string;
} | null;

export type PatientDashboardSnapshot = {
  woundSites: WoundSiteRecord[];
  tasks: ScheduledTask[];
  alerts: PatientAlert[];
  teleconsult: UpcomingTeleconsult;
};
