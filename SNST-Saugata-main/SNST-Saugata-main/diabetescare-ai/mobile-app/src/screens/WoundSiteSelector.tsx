import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import WoundSiteSelectorPanel from '../components/WoundSiteSelectorPanel';
import type {WoundZoneOption} from '../components/woundSiteTypes';
import {logoutToRoleSelect, resetToPatientHome} from '../navigation/navigationUtils';
import {addWoundSite, getPatientDashboard} from '../storage/patientDashboardStorage';
import type {WoundSiteRecord} from '../types/patientDashboard';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WoundSiteSelector'>;

export default function WoundSiteSelector({navigation}: {navigation: Nav}) {
  const [selected, setSelected] = useState<WoundZoneOption | null>(null);
  const [existing, setExisting] = useState<WoundSiteRecord[]>([]);

  const load = useCallback(async () => {
    const d = await getPatientDashboard();
    setExisting(d.woundSites.filter(w => w.active));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async () => {
    if (!selected) {
      Alert.alert('Select a zone', 'Tap a region on the diagram first.');
      return;
    }
    if (existing.length >= 5) {
      Alert.alert('Limit', 'You can track up to 5 active wound sites.');
      return;
    }
    const row = await addWoundSite({
      label: selected.label,
      side: selected.side,
      zone: selected.zone,
      active: true,
      lastDot: 'green',
      overdueDays: 0,
      sessionDueToday: true,
    });
    navigation.replace('WoundMonitorHome', {
      wound_site_id: row.id,
      wound_site_label: row.label,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Select wound location</Text>
        <WoundSiteSelectorPanel selected={selected} onSelect={setSelected} />
        <TouchableOpacity style={styles.primary} onPress={onAdd}>
          <Text style={styles.primaryText}>Add this wound site</Text>
        </TouchableOpacity>
        <Text style={styles.section}>My existing wound sites</Text>
        {existing.length === 0 ? (
          <Text style={styles.muted}>None yet.</Text>
        ) : (
          existing.map(w => (
            <TouchableOpacity
              key={w.id}
              style={styles.siteRow}
              onPress={() =>
                navigation.replace('WoundMonitorHome', {
                  wound_site_id: w.id,
                  wound_site_label: w.label,
                })
              }>
              <Text style={styles.siteName}>{w.label}</Text>
              <Text style={styles.siteHint}>Open dashboard →</Text>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity style={styles.back} onPress={() => resetToPatientHome(navigation)}>
          <Text style={styles.backText}>Back to patient home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void logoutToRoleSelect(navigation)}>
          <Text style={styles.switchLinkText}>Who is using this device?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 18, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  primary: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  section: {marginTop: 22, marginBottom: 8, color: '#F8FAFC', fontWeight: '900', fontSize: 15},
  muted: {color: 'rgba(248,250,252,0.55)'},
  siteRow: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  siteName: {color: '#F8FAFC', fontWeight: '800'},
  siteHint: {marginTop: 4, color: '#93C5FD', fontSize: 12},
  back: {marginTop: 16, padding: 14, alignItems: 'center'},
  backText: {color: '#94A3B8', fontWeight: '800'},
  switchLinkText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#93C5FD',
    fontWeight: '800',
    fontSize: 15,
  },
});
