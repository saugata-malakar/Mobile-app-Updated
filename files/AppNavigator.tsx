// mobile-app/src/navigation/AppNavigator.tsx
// Root navigator for DiabetesCare AI mobile app

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

import PatientRegistrationScreen from '../screens/PatientRegistrationScreen';
import PhotoFlowScreen           from '../screens/PhotoFlowScreen';
import CaptureScreen             from '../screens/CaptureScreen';
import ReviewScreen              from '../screens/ReviewScreen';
import SuccessScreen             from '../screens/SuccessScreen';

// ── Route param types ──────────────────────────────────────────────────────
export type RootStackParamList = {
  PatientRegistration: undefined;
  PhotoFlow: {
    patientId:  string;
    visitId:    string;
    operatorId: string;
  };
  Capture: {
    patientId:  string;
    visitId:    string;
    photoType:  'overview' | 'close_up' | 'measurement';
    operatorId: string;
  };
  Review: {
    patientId:       string;
    visitId:         string;
    photoType:       string;
    operatorId:      string;
    captureResponse: any;
    annotatedImageB64: string;
    measurements: {
      length_mm?:    number;
      width_mm?:     number;
      area_cm2?:     number;
      perimeter_mm?: number;
      confidence?:   number;
      measurement_id?: string;
    };
  };
  Success: { patientId: string; visitId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const NAVY  = '#1F3864';

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="PatientRegistration"
        screenOptions={{
          headerStyle:      { backgroundColor: NAVY },
          headerTintColor:  '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitleVisible: false,
        }}>

        <Stack.Screen
          name="PatientRegistration"
          component={PatientRegistrationScreen}
          options={{ title: 'New Patient' }}
        />
        <Stack.Screen
          name="PhotoFlow"
          component={PhotoFlowScreen}
          options={{ title: 'Photo Collection' }}
        />
        <Stack.Screen
          name="Capture"
          component={CaptureScreen}
          options={{ title: 'Capture', headerShown: false }}
        />
        <Stack.Screen
          name="Review"
          component={ReviewScreen}
          options={{ title: 'Review Capture' }}
        />
        <Stack.Screen
          name="Success"
          component={SuccessScreen}
          options={{ title: 'Complete', headerLeft: () => null }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// mobile-app/src/screens/PhotoFlowScreen.tsx
// Guides ASHA worker through 3 mandatory photos in sequence

import React, { useState } from 'react';
import {
  View, Text, StyleSheet as S, TouchableOpacity,
  ScrollView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

type PhotoFlowRoute = RouteProp<RootStackParamList, 'PhotoFlow'>;

const PHOTO_STEPS = [
  {
    type:        'overview' as const,
    title:       'Overview Photo',
    description: 'Capture the full limb or body area for clinical context.',
    icon:        '📷',
    required:    true,
  },
  {
    type:        'close_up' as const,
    title:       'Close-Up Photo',
    description: 'Fill the frame with the wound — capture fine details.',
    icon:        '🔍',
    required:    true,
  },
  {
    type:        'measurement' as const,
    title:       'Measurement Photo',
    description:
      'Place the blue calibrant sticker on INTACT SKIN adjacent to the wound. ' +
      'Ensure the sticker is fully visible.',
    icon:        '📏',
    required:    true,
  },
];

export function PhotoFlowScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<PhotoFlowRoute>();
  const { patientId, visitId, operatorId } = route.params;
  const [done, setDone] = useState<Record<string, boolean>>({});

  const allDone = PHOTO_STEPS.every(s => done[s.type]);

  return (
    <ScrollView style={pf.container} contentContainerStyle={pf.content}>
      <Text style={pf.heading}>Photo Collection</Text>
      <Text style={pf.subheading}>
        3 photos required · Complete all steps
      </Text>

      {PHOTO_STEPS.map((step, i) => {
        const isDone = !!done[step.type];
        return (
          <View key={step.type} style={[pf.card, isDone && pf.cardDone]}>
            <View style={pf.stepHeader}>
              <View style={[pf.stepNum, isDone && pf.stepNumDone]}>
                <Text style={pf.stepNumText}>{isDone ? '✓' : i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pf.stepIcon}>{step.icon}</Text>
                <Text style={pf.stepTitle}>{step.title}</Text>
                <Text style={pf.stepDesc}>{step.description}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[pf.captureBtn, isDone && pf.captureBtnDone]}
              onPress={() => {
                navigation.navigate('Capture', {
                  patientId, visitId, operatorId,
                  photoType: step.type,
                });
                // Mark done when returning (handled via focus listener in production)
                setTimeout(() => setDone(prev => ({ ...prev, [step.type]: true })), 3000);
              }}>
              <Text style={pf.captureBtnText}>
                {isDone ? '✓ Retake' : 'Capture →'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* ── Sticker reminder ───────────────────────────────────────────── */}
      <View style={pf.stickerNote}>
        <Text style={pf.stickerNoteTitle}>🔵 Before Measurement Photo:</Text>
        <Text style={pf.stickerNoteText}>
          Peel and place the calibrant sticker on intact skin, 1–2 cm from the
          wound edge. Single use — discard after each patient.
        </Text>
      </View>

      {/* ── Complete button ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[pf.doneBtn, !allDone && pf.doneBtnDisabled]}
        onPress={() => navigation.navigate('Success', { patientId, visitId })}
        disabled={!allDone}>
        <Text style={pf.doneBtnText}>
          {allDone ? 'Complete Collection ✓' : `${Object.values(done).filter(Boolean).length}/3 Photos Captured`}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

export default PhotoFlowScreen;

const W = '#FFFFFF';
const N = '#1F3864';
const G = '#2ECC71';
const GR= '#F5F6FA';

const pf = S.create({
  container:        { flex: 1, backgroundColor: GR },
  content:          { padding: 16, paddingBottom: 48 },
  heading:          { fontSize: 22, fontWeight: '800', color: N, marginBottom: 4 },
  subheading:       { fontSize: 13, color: '#888', marginBottom: 20 },
  card: {
    backgroundColor: W, borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardDone:         { borderColor: G },
  stepHeader:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E0E4EE', justifyContent: 'center',
    alignItems: 'center', marginRight: 12,
  },
  stepNumDone:      { backgroundColor: G },
  stepNumText:      { fontWeight: '800', fontSize: 14, color: N },
  stepIcon:         { fontSize: 20, marginBottom: 2 },
  stepTitle:        { fontSize: 15, fontWeight: '700', color: N },
  stepDesc:         { fontSize: 13, color: '#666', marginTop: 3, lineHeight: 18 },
  captureBtn: {
    backgroundColor: N, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  captureBtnDone:   { backgroundColor: '#E8F8EE', borderWidth: 1.5, borderColor: G },
  captureBtnText:   { color: W, fontWeight: '700', fontSize: 14 },
  stickerNote: {
    backgroundColor: '#EFF6FF', borderRadius: 10,
    padding: 14, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#2196F3',
  },
  stickerNoteTitle: { fontSize: 14, fontWeight: '700', color: '#1565C0', marginBottom: 4 },
  stickerNoteText:  { fontSize: 13, color: '#1565C0', lineHeight: 18 },
  doneBtn: {
    backgroundColor: N, borderRadius: 12,
    paddingVertical: 17, alignItems: 'center',
  },
  doneBtnDisabled:  { backgroundColor: '#AAB0C0' },
  doneBtnText:      { color: W, fontWeight: '800', fontSize: 16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// mobile-app/src/screens/SuccessScreen.tsx

import { useNavigation as useNav, useRoute as useR, RouteProp as RP } from '@react-navigation/native';
type SuccessRoute = RP<RootStackParamList, 'Success'>;

export function SuccessScreen() {
  const nav   = useNav<any>();
  const route = useR<SuccessRoute>();
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
        onPress={() => nav.navigate('PatientRegistration')}>
        <Text style={sc.buttonText}>Register Next Patient</Text>
      </TouchableOpacity>
    </View>
  );
}

const sc = S.create({
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
