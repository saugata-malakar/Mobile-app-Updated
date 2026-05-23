import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import WoundSiteSelectorPanel from '../components/WoundSiteSelectorPanel';
import type {WoundZoneOption} from '../components/woundSiteTypes';
import {resetToAshaHome} from '../navigation/navigationUtils';
import {createAshaPatientWoundSite} from '../services/woundSiteService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaWoundSiteSetup'>;
type Rt = RouteProp<RootStackParamList, 'AshaWoundSiteSetup'>;

export default function AshaWoundSiteSetup({navigation, route}: {navigation: Nav; route: Rt}) {
  const {patientId, patientName} = route.params;
  const [selected, setSelected] = useState<WoundZoneOption | null>(null);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (!selected) {
      Alert.alert('Select a zone', 'Tap a region on the foot diagram first.');
      return;
    }
    setBusy(true);
    try {
      const result = await createAshaPatientWoundSite(patientId, patientName, selected);
      Alert.alert(
        result.queued ? 'Saved offline' : 'Wound site saved',
        result.queued
          ? 'Will upload when you are back online. You can start a monitoring visit from ASHA home.'
          : `${result.label} recorded for ${patientName}.`,
        [{text: 'OK', onPress: () => resetToAshaHome(navigation)}],
      );
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Record wound site (A11)</Text>
        <Text style={styles.sub}>Patient: {patientName}</Text>
        <Text style={styles.hint}>
          Same foot diagram as patient flow (P8). Saved to the server for this patient when online.
        </Text>

        <WoundSiteSelectorPanel selected={selected} onSelect={setSelected} />

        <TouchableOpacity
          style={[styles.primary, (!selected || busy) && styles.off]}
          disabled={!selected || busy}
          onPress={onSave}>
          {busy ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={styles.primaryText}>Save wound site</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => resetToAshaHome(navigation)}>
          <Text style={[styles.link, styles.linkSpaced]}>Back to ASHA home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 18, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  sub: {marginTop: 6, color: '#93C5FD', fontWeight: '800'},
  hint: {marginTop: 8, color: 'rgba(248,250,252,0.65)', lineHeight: 20, marginBottom: 4},
  primary: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#059669',
  },
  off: {opacity: 0.5},
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  link: {marginTop: 14, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
  linkSpaced: {marginTop: 8},
});
