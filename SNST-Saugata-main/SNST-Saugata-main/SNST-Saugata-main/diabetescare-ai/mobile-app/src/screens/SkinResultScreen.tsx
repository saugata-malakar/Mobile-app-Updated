import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {resetToPatientHome} from '../navigation/navigationUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SkinResult'>;

export default function SkinResultScreen({navigation}: {navigation: Nav}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.banner}>Review complete</Text>
        <Text style={styles.body}>
          Demo results: mild xerosis — OTC emollient, daily. Next assessment in 30 days.
        </Text>
        <TouchableOpacity onPress={() => resetToPatientHome(navigation)}>
          <Text style={styles.link}>Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20},
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.2)',
    color: '#FEF3C7',
    fontWeight: '900',
    fontSize: 16,
  },
  body: {marginTop: 14, color: 'rgba(248,250,252,0.8)', lineHeight: 22},
  link: {marginTop: 20, color: '#93C5FD', fontWeight: '800', textAlign: 'center'},
});
