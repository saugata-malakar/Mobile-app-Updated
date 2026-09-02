import React, {useCallback, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import type {PatientProfile} from '../types/app';
import {getSession, listAshaPatients, normalizePhone} from '../storage/appStorage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaPatientSearch'>;

export default function AshaPatientSearch({navigation}: {navigation: Nav}) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<PatientProfile[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const s = await getSession();
        if (s?.role === 'asha') {
          setAll(await listAshaPatients(s.phone));
        }
      })();
    }, []),
  );

  const q = query.trim().toLowerCase();
  const results = q
    ? all.filter(
        p =>
          p.fullName.toLowerCase().includes(q) ||
          normalizePhone(p.phone).includes(q.replace(/\D/g, '')) ||
          (p.village && p.village.toLowerCase().includes(q)),
      )
    : all;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Find patient (A7)</Text>
        <Text style={styles.sub}>Search before registering to avoid duplicates.</Text>
        <TextInput
          style={styles.input}
          placeholder="Name or phone…"
          placeholderTextColor="rgba(148,163,184,0.85)"
          value={query}
          onChangeText={setQuery}
        />
        {results.map(p => (
          <TouchableOpacity
            key={p.id}
            style={styles.row}
            onPress={() =>
              navigation.navigate('LanguageSelect', {
                screeningContext: {
                  sessionRole: 'asha',
                  patientId: p.id,
                  patientName: p.fullName,
                  followUp: true,
                },
              })
            }>
            <Text style={styles.name}>{p.fullName}</Text>
            <Text style={styles.meta}>{p.phone} · {p.village || '—'}</Text>
          </TouchableOpacity>
        ))}
        {q && results.length === 0 ? (
          <Text style={styles.empty}>No match — register as new patient.</Text>
        ) : null}
        <TouchableOpacity
          style={styles.primary}
          onPress={() => navigation.navigate('PatientRegistration', {flow: 'asha_new'})}>
          <Text style={styles.primaryText}>Register new patient</Text>
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
  sub: {marginTop: 6, color: 'rgba(248,250,252,0.72)', marginBottom: 12},
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    padding: 12,
    color: '#F8FAFC',
    backgroundColor: 'rgba(15,23,42,0.55)',
    marginBottom: 14,
  },
  row: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  name: {color: '#F8FAFC', fontWeight: '800'},
  meta: {marginTop: 4, color: 'rgba(148,163,184,0.95)', fontSize: 13},
  empty: {color: '#FBBF24', marginVertical: 12},
  primary: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
  link: {marginTop: 14, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
