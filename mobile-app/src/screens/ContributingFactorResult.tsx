import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {resetToPatientHome} from '../navigation/navigationUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ContributingFactorResult'>;

export default function ContributingFactorResult({navigation}: {navigation: Nav}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h}>Pallor</Text>
        <Text style={styles.body}>Mild — consider a blood test at your next visit.</Text>
        <Text style={styles.h}>Eye</Text>
        <Text style={styles.body}>Non-urgent irritation pattern — lubricating drops, avoid rubbing.</Text>
        <Text style={styles.h}>Wound link</Text>
        <Text style={styles.body}>Good nutrition and blood levels support faster healing.</Text>
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
  h: {marginTop: 14, fontWeight: '900', color: '#F8FAFC', fontSize: 16},
  body: {marginTop: 6, color: 'rgba(248,250,252,0.8)', lineHeight: 20},
  link: {marginTop: 22, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
