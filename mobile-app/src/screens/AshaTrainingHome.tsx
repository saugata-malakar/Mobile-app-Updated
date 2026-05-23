import React, {useState} from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {getSession} from '../storage/appStorage';
import {setAshaTrainingComplete} from '../storage/ashaTrainingStorage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AshaTrainingHome'>;

const MODULES = [
  {id: 'm1', title: 'Wound photography basics', done: false},
  {id: 'm2', title: 'Coin placement & quality', done: false},
  {id: 'm3', title: 'Referral & urgent cases', done: false},
  {id: 'm4', title: 'Privacy & consent', done: false},
];

export default function AshaTrainingHome({navigation}: {navigation: Nav}) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  const allDone = MODULES.every(m => done[m.id]);

  const toggle = (id: string) => setDone(d => ({...d, [id]: !d[id]}));

  const finish = async () => {
    const s = await getSession();
    if (s?.phone) {
      await setAshaTrainingComplete(s.phone, true);
    }
    navigation.replace('AshaHome');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>ASHA training (A13)</Text>
        <Text style={styles.sub}>
          Complete all modules before using the field portal. Demo: tap each module to mark complete.
        </Text>
        {MODULES.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[styles.card, done[m.id] && styles.cardOn]}
            onPress={() => toggle(m.id)}>
            <Text style={styles.cardTitle}>{m.title}</Text>
            <Text style={styles.cardHint}>{done[m.id] ? '✓ Done' : 'Tap to mark complete'}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.primary, !allDone && styles.primaryOff]}
          disabled={!allDone}
          onPress={finish}>
          <Text style={styles.primaryText}>Continue to ASHA home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  sub: {marginTop: 8, color: 'rgba(248,250,252,0.75)', lineHeight: 20, marginBottom: 16},
  card: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  cardOn: {borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.12)'},
  cardTitle: {color: '#F8FAFC', fontWeight: '900'},
  cardHint: {marginTop: 6, color: 'rgba(148,163,184,0.9)', fontSize: 13},
  primary: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryOff: {opacity: 0.45},
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
});
