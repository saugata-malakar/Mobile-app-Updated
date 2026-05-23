import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RedEyeCapture'>;

export default function RedEyeCapture({navigation}: {navigation: Nav}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Eye triage</Text>
        <Text style={styles.disclaimer}>
          This checks the outside of your eye only — not the retina. Ask your doctor about a separate
          retina check if you have diabetes.
        </Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() =>
            navigation.navigate('CameraScreen', {
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
          <Text style={styles.primaryText}>Take photograph</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ContributingFactorResult')}>
          <Text style={styles.link}>Skip to demo result</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  disclaimer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(234,179,8,0.12)',
    color: '#FEF3C7',
    lineHeight: 20,
  },
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
