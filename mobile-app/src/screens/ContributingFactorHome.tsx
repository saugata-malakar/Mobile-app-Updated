import React, {useState} from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {logoutToRoleSelect, resetToPatientHome} from '../navigation/navigationUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ContributingFactorHome'>;

export default function ContributingFactorHome({navigation}: {navigation: Nav}) {
  const [redEye, setRedEye] = useState(false);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Contributing factors</Text>
        <Text style={styles.card}>
          We check anaemia (pallor) and urgent eye symptoms that can affect wound healing.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('PallorCaptureGuide')}>
          <Text style={styles.btnText}>Pallor assessment</Text>
        </TouchableOpacity>
        <Text style={styles.q}>Red or painful eye today?</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.chip, redEye && styles.chipOn]} onPress={() => setRedEye(true)}>
            <Text style={styles.chipT}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, !redEye && styles.chipOn]} onPress={() => setRedEye(false)}>
            <Text style={styles.chipT}>No</Text>
          </TouchableOpacity>
        </View>
        {redEye ? (
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('RedEyeCapture')}>
            <Text style={styles.btnText}>Eye triage — assess now</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => resetToPatientHome(navigation)}>
          <Text style={styles.link}>Back to patient home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void logoutToRoleSelect(navigation)}>
          <Text style={[styles.link, styles.switchLink]}>Who is using this device?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    color: 'rgba(248,250,252,0.85)',
    lineHeight: 20,
  },
  btn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnText: {color: '#F8FAFC', fontWeight: '900'},
  q: {marginTop: 18, color: '#F8FAFC', fontWeight: '800'},
  row: {flexDirection: 'row', gap: 10, marginTop: 10},
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    alignItems: 'center',
  },
  chipOn: {borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.15)'},
  chipT: {color: '#E2E8F0', fontWeight: '800'},
  link: {marginTop: 22, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
  switchLink: {marginTop: 8},
});
