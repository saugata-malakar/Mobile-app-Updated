export type NotificationPrefs = {
  session_reminder_days_before: string;
  session_reminder_time: string;
  overdue_reminder_enabled: boolean;
  overdue_reminder_after_days: number;
  alert_sms_enabled: boolean;
  alert_push_enabled: boolean;
  payment_notifications_enabled: boolean;
  prescription_notifications_enabled: boolean;
  marketing_enabled: boolean;
  language: 'en' | 'bn';
};

export type InAppNotification = {
  id: string;
  notification_type: string;
  title_en: string;
  title_bn?: string | null;
  body_en: string;
  body_bn?: string | null;
  deep_link?: string | null;
  data?: unknown;
  channel: string;
  sent_at: string | null;
  read_at: string | null;
  action_taken: boolean;
};
