import type {AppRole} from '../types/app';

export const V4_COLORS = {
  bg: '#0B1220',
  card: 'rgba(15, 23, 42, 0.8)',
  cardSolid: '#0F172A',
  cardBorder: 'rgba(148, 163, 184, 0.22)',
  primary: '#2563EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#F8FAFC',
  mutedText: 'rgba(248, 250, 252, 0.72)',
  inputBg: 'rgba(15, 23, 42, 0.65)',
  chipBg: 'rgba(30, 41, 59, 0.9)',
};

export function roleDisplayTitle(role: AppRole): string {
  switch (role) {
    case 'doctor':
      return 'Doctor';
    case 'field_worker':
      return 'ASHA / ICDS / CHO';
    case 'moderator':
      return 'Moderator';
    case 'admin':
      return 'Admin';
  }
}

export function statusBadgeInfo(status: string): {
  label: string;
  color: string;
  bg: string;
} {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'draft':
      return {label: 'Submitted', color: '#93C5FD', bg: 'rgba(37, 99, 235, 0.2)'};
    case 'submitted':
      return {label: 'Submitted', color: '#93C5FD', bg: 'rgba(37, 99, 235, 0.2)'};
    case 'ai_reviewed':
      return {
        label: 'Moderator Review',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.18)',
      };
    case 'moderator_approved':
      return {
        label: 'Doctor Reviewing',
        color: '#60A5FA',
        bg: 'rgba(59, 130, 246, 0.2)',
      };
    case 'accepted':
      return {
        label: 'Accepted ✓',
        color: '#22C55E',
        bg: 'rgba(34, 197, 94, 0.18)',
      };
    case 'doctor_completed':
    case 'paid':
      return {
        label: 'Paid ✓',
        color: '#22C55E',
        bg: 'rgba(34, 197, 94, 0.18)',
      };
    case 'rejected':
    case 'moderator_rejected':
      return {
        label: 'Rejected ✗',
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.18)',
      };
    default:
      return {
        label: status || 'Pending',
        color: '#CBD5E1',
        bg: 'rgba(148, 163, 184, 0.18)',
      };
  }
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) {
    return 'Just now';
  }
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
