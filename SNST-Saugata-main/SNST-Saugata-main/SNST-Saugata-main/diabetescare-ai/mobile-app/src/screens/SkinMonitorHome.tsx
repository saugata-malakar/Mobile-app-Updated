import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {logoutToRoleSelect, resetToPatientHome} from '../navigation/navigationUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SkinMonitorHome'>;

export default function SkinMonitorHome({navigation}: {navigation: Nav}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Skin assessment</Text>
        <Text style={styles.body}>Last: — · Next due: in 12 days</Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => navigation.navigate('SkinSessionGuide', {language: 'en'})}>
          <Text style={styles.primaryText}>Start skin assessment</Text>
        </TouchableOpacity>
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
  body: {marginTop: 10, color: 'rgba(248,250,252,0.75)', lineHeight: 20},
  primary: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
  link: {marginTop: 18, color: '#93C5FD', fontWeight: '800', textAlign: 'center'},
  switchLink: {marginTop: 8},
});
