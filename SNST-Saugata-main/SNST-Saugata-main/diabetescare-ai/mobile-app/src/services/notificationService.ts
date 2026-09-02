import {api} from './apiClient';
import type {InAppNotification, NotificationPrefs} from '../types/notifications';

export async function getMyNotifications(params?: {
  unread_only?: boolean;
  limit?: number;
}): Promise<InAppNotification[]> {
  const res = await api.get('/api/v1/notifications/me', {params});
  return (res.data?.data ?? []) as InAppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.put(`/api/v1/notifications/${id}/read`, {});
}

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  const res = await api.get('/api/v1/notifications/preferences');
  return res.data?.data as NotificationPrefs;
}

export async function putNotificationPreferences(body: Partial<NotificationPrefs>): Promise<void> {
  await api.put('/api/v1/notifications/preferences', body);
}

export async function postDeviceFcmToken(fcmToken: string): Promise<void> {
  await api.post('/api/v1/notifications/device-token', {fcm_token: fcmToken});
}
