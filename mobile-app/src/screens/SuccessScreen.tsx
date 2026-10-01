// mobile-app/src/screens/SuccessScreen.tsx
// Confirmation screen after data collection completion

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

type SuccessRoute = RouteProp<RootStackParamList, 'Success'>;

export default function SuccessScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<SuccessRoute>();
  const { patientId } = route.params;

  return (
    <View style={sc.container}>
      <Text style={sc.icon}>✅</Text>
      <Text style={sc.title}>Data Collection Complete</Text>
      <Text style={sc.subtitle}>
        Photo & clinical metrics saved successfully.{'\n'}
        Stored in local database & stored_photos/ folder.
      </Text>
      <Text style={sc.patientId}>Patient ID: {patientId}</Text>

      <TouchableOpacity
        style={sc.button}
        onPress={() => navigation.navigate('DoctorCommandHub', { userRole: 'doctor' })}>
        <Text style={sc.buttonText}>Return to Clinical Command Hub</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[sc.button, { backgroundColor: '#334155', marginTop: 12 }]}
        onPress={() => navigation.navigate('PatientRegistration')}>
        <Text style={sc.buttonText}>Register Next Patient</Text>
      </TouchableOpacity>
    </View>
  );
}

const sc = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0B132B', justifyContent: 'center', alignItems: 'center', padding: 24 },
  icon:       { fontSize: 60, marginBottom: 16 },
  title:      { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  subtitle:   { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  patientId:  { fontSize: 12, color: '#64748B', marginBottom: 28, fontFamily: 'monospace' },
  button: {
    backgroundColor: '#2563EB', borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 30, width: '100%', alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
