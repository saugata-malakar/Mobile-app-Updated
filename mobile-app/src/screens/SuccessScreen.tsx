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
        All photos captured and uploaded securely.{'\n'}
        AI analysis is processing in the background.
      </Text>
      <Text style={sc.patientId}>Patient ID: {patientId.slice(-12)}</Text>

      <TouchableOpacity
        style={sc.button}
        onPress={() => navigation.navigate('PatientRegistration')}>
        <Text style={sc.buttonText}>Register Next Patient</Text>
      </TouchableOpacity>
    </View>
  );
}

const sc = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F6FA', justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon:       { fontSize: 64, marginBottom: 20 },
  title:      { fontSize: 24, fontWeight: '800', color: '#1F3864', marginBottom: 10, textAlign: 'center' },
  subtitle:   { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  patientId:  { fontSize: 12, color: '#AAA', marginBottom: 32 },
  button: {
    backgroundColor: '#1F3864', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 40,
  },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
