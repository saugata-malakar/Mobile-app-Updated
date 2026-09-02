import React from 'react';
import {Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DataPrivacySettings'>;

export default function DataPrivacySettings({navigation}: {navigation: Nav}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Data & privacy</Text>
        <Text style={styles.body}>DPDP 2023 — plain language: we store profile, photos, and session outcomes to care for you.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('Request data', 'Server email link placeholder.')}>
          <Text style={styles.btnText}>Request your data</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.danger} onPress={() => Alert.alert('Delete account', 'Irreversible — confirm in production.')}>
          <Text style={styles.dangerText}>Delete my account</Text>
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
  btn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnText: {color: '#F8FAFC', fontWeight: '900'},
  danger: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
  },
  dangerText: {color: '#FECACA', fontWeight: '900'},
  link: {marginTop: 18, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
