import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CoinPlacementGuide'>;
type Rt = RouteProp<RootStackParamList, 'CoinPlacementGuide'>;

export default function CoinPlacementGuide({navigation, route}: {navigation: Nav; route: Rt}) {
  const lang = route.params?.language === 'bn' ? 'bn' : 'en';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Coin placement</Text>
        <Text style={styles.body}>
          {lang === 'bn'
            ? '১ টাকার কয়েনটি চাপড়া রেখে ক্ষতের ধারে স্পর্শ করুন।'
            : 'Lay the 1-rupee coin flat on the skin, touching the wound edge.'}
        </Text>

        <View style={styles.demo}>
          <Text style={styles.ok}>✓ Correct</Text>
          <Text style={styles.demoTxt}>Coin flat, visible, single coin, touching wound margin.</Text>
        </View>
        <View style={styles.bad}>
          <Text style={styles.badTitle}>✕ Wrong</Text>
          <Text style={styles.demoTxt}>Coin on wound, floating, multiple coins, or edge-only.</Text>
        </View>

        <Text style={styles.note}>
          The app will check that the coin is visible. If it cannot see the coin, it will ask you to
          try again.
        </Text>

        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Got it</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  body: {marginTop: 10, color: 'rgba(248,250,252,0.78)', lineHeight: 22},
  demo: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  ok: {color: '#86EFAC', fontWeight: '900', marginBottom: 6},
  bad: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
  },
  badTitle: {color: '#FECACA', fontWeight: '900', marginBottom: 6},
  demoTxt: {color: '#E2E8F0', lineHeight: 20},
  note: {marginTop: 16, color: 'rgba(148,163,184,0.95)', lineHeight: 18, fontSize: 13},
  btn: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnText: {color: '#F8FAFC', fontWeight: '900'},
});
