// mobile-app/src/screens/PhotoFlowScreen.tsx
// Guides ASHA worker through 3 mandatory photos in sequence

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

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

export default function PhotoFlowScreen() {
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

const W = '#FFFFFF';
const N = '#1F3864';
const G = '#2ECC71';
const GR= '#F5F6FA';

const pf = StyleSheet.create({
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
