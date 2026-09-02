import NetInfo from '@react-native-community/netinfo';
import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {getPendingCount} from '../services/offlineQueue';

export default function NetworkStatus() {
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(() => {
    getPendingCount().then(setPending);
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => {
      setOffline(!s.isConnected);
    });
    refreshPending();
    const tick = setInterval(refreshPending, 3000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [refreshPending]);

  if (!offline && pending === 0) {
    return null;
  }

  return (
    <View style={[styles.banner, offline ? styles.offline : styles.online]}>
      <Text style={styles.text}>
        {offline
          ? 'Offline — data will upload when connected'
          : 'Back online — syncing'}
        {pending > 0 ? ` · ${pending} queued` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  offline: {backgroundColor: 'rgba(234,179,8,0.18)'},
  online: {backgroundColor: 'rgba(34,197,94,0.15)'},
  text: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
