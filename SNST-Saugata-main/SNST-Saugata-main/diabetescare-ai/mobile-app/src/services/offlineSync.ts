import NetInfo from '@react-native-community/netinfo';

import {api} from './apiClient';
import {listPending, markAttempt, removeById, setLastSuccessfulSyncMs} from './offlineQueue';

async function flushOnce(): Promise<{processed: number; errors: number}> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    return {processed: 0, errors: 0};
  }
  const pending = await listPending();
  let processed = 0;
  let errors = 0;
  for (const row of pending) {
    try {
      await api.request({
        method: row.method,
        url: row.path,
        data: row.body,
      });
      await removeById(row.id);
      processed += 1;
    } catch {
      await markAttempt(row.id, true);
      errors += 1;
    }
  }
  if (processed > 0) {
    await setLastSuccessfulSyncMs(Date.now());
  }
  return {processed, errors};
}

/** When the device is online, replay queued API writes. */
export function startOfflineQueueFlush(): () => void {
  const unsubscribe = NetInfo.addEventListener(async state => {
    if (!state.isConnected) {
      return;
    }
    await flushOnce();
  });
  return unsubscribe;
}

/** Manual sync from A16 "Upload now". */
export function flushOfflineQueueNow(): Promise<{processed: number; errors: number}> {
  return flushOnce();
}
