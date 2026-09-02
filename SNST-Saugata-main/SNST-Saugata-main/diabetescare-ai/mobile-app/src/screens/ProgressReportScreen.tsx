import React from 'react';
import {Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProgressReport'>;
type Rt = RouteProp<RootStackParamList, 'ProgressReport'>;

export default function ProgressReportScreen({navigation}: {navigation: Nav}) {
  const route = useRoute<Rt>();
  const woundId = route.params?.wound_site_id;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Healing report</Text>
        <Text style={styles.body}>
          {woundId
            ? `Wound site ${woundId} — demo summary. Server PDF: GET /sessions/:wound_site_id/report.`
            : 'Select a wound site from home for a site-specific report (demo).'}
        </Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => Alert.alert('PDF', 'Server-side generation not wired in this build.')}>
          <Text style={styles.primaryText}>Generate PDF</Text>
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
  body: {marginTop: 10, color: 'rgba(248,250,252,0.78)', lineHeight: 20},
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
