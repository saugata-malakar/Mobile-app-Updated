import React, {useEffect} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {StackActions, useNavigation} from '@react-navigation/native';
import {resolveInitialRoute} from '../navigation/resolveInitialRoute';

export default function SplashScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    let alive = true;
    (async () => {
      await new Promise(r => setTimeout(r, 900));
      if (!alive) {
        return;
      }
      const route = await resolveInitialRoute();
      navigation.dispatch(
        StackActions.replace(route.name, 'params' in route ? route.params : undefined),
      );
    })();
    return () => {
      alive = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>HS</Text>
      </View>
      <Text style={styles.title}>HealthScreen</Text>
      <Text style={styles.subtitle}>DiabetesCare AI · wound monitoring</Text>
      <ActivityIndicator style={styles.spinner} size="large" color="#2563EB" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0B1220',
  },
  logoCircle: {
    height: 92,
    width: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111C33',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  logoText: {fontSize: 28, fontWeight: '800', color: '#E6F0FF'},
  title: {marginTop: 14, fontSize: 28, fontWeight: '800', color: '#F8FAFC'},
  subtitle: {marginTop: 6, fontSize: 14, color: 'rgba(248,250,252,0.72)'},
  spinner: {marginTop: 28},
});
