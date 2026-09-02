/** Commission rate table (reference — server is source of truth for credits). */
export const ASHA_COMMISSION_RATES = [
  {type: 'PATIENT_REGISTRATION', label: 'Patient registration', amountRs: 50},
  {type: 'RESEARCH_SCREENING', label: 'Research screening submitted', amountRs: 30},
  {type: 'MONITORING_SUBMISSION', label: 'Monitoring session submitted', amountRs: 20},
  {type: 'COMMERCIAL_ENROLMENT', label: 'Commercial enrolment', amountRs: 100},
  {type: 'QUALITY_BONUS', label: 'Wound photo quality score > 80', amountRs: 10},
  {type: 'MONTHLY_RETENTION_BONUS', label: 'Patient active 3+ months (monthly)', amountRs: 200},
] as const;
