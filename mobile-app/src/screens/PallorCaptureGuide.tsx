import React, {useState} from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PallorCaptureGuide'>;

export default function PallorCaptureGuide({navigation}: {navigation: Nav}) {
  const [sym, setSym] = useState({red: false, discharge: false, itch: false, pain: false, blur: false});
  const any = Object.values(sym).some(Boolean);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Pallor photograph</Text>
        <Text style={styles.q}>Any eye symptoms today?</Text>
        {(['red', 'discharge', 'itch', 'pain', 'blur'] as const).map(k => (
          <TouchableOpacity key={k} style={styles.row} onPress={() => setSym(s => ({...s, [k]: !s[k]}))}>
            <Text style={styles.cb}>{sym[k] ? '☑' : '☐'}</Text>
            <Text style={styles.lbl}>
              {k === 'red'
                ? 'Red eye'
                : k === 'discharge'
                  ? 'Discharge'
                  : k === 'itch'
                    ? 'Itching'
                    : k === 'pain'
                      ? 'Painful eye'
                      : 'Blurred vision'}
            </Text>
          </TouchableOpacity>
        ))}
        {any ? (
          <Text style={styles.warn}>Use eye triage instead of pallor for this session.</Text>
        ) : null}
        <TouchableOpacity
          style={styles.primary}
          onPress={() =>
            any
              ? navigation.navigate('RedEyeCapture')
              : navigation.navigate('CameraScreen', {
                  condition: 'eye',
                  language: 'en',
                  screeningContext: {
                    sessionRole: 'patient',
                    patientId: 'self',
                    patientName: 'You',
                    followUp: false,
                  },
                })
          }>
          <Text style={styles.primaryText}>{any ? 'Go to eye triage' : 'Take pallor photo'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  q: {marginTop: 12, color: 'rgba(248,250,252,0.85)', marginBottom: 8},
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8},
  cb: {width: 28, color: '#93C5FD', fontSize: 18},
  lbl: {color: '#E2E8F0', fontWeight: '700'},
  warn: {marginTop: 12, color: '#FDE68A'},
  primary: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
  link: {marginTop: 16, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
