import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SkinSessionGuide'>;
type Rt = RouteProp<RootStackParamList, 'SkinSessionGuide'>;

export default function SkinSessionGuide({navigation, route}: {navigation: Nav; route: Rt}) {
  const lang = route.params?.language === 'bn' ? 'bn' : 'en';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Skin photo guide</Text>
        <Text style={styles.step}>1. Web spaces between toes</Text>
        <Text style={styles.step}>2. Sole of the foot</Text>
        <Text style={styles.step}>3. Around the wound</Text>
        <Text style={styles.step}>4. Lower leg skin (optional)</Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() =>
            navigation.navigate('CameraScreen', {
              condition: 'skin',
              language: lang,
              screeningContext: {
                sessionRole: 'patient',
                patientId: 'self',
                patientName: 'You',
                followUp: false,
              },
            })
          }>
          <Text style={styles.primaryText}>Open camera</Text>
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
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginBottom: 12},
  step: {marginTop: 8, color: 'rgba(248,250,252,0.85)', lineHeight: 20},
  primary: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900'},
  link: {marginTop: 16, textAlign: 'center', color: '#93C5FD', fontWeight: '800'},
});
