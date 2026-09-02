import React, {useEffect} from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import {startOfflineQueueFlush} from './src/services/offlineSync';

export default function App() {
  useEffect(() => {
    const unsub = startOfflineQueueFlush();
    return unsub;
  }, []);

  return <RootNavigator />;
}