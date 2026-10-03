// mobile-app/src/screens/PhotoFlowScreen.tsx
// Guides Doctor / ASHA worker through 3 mandatory photos in sequence.
// Enforces: Overview → Close-Up → Measurement — ALL required before Review.

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
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

  // Track which photos are done and store their capture results
  const [done, setDone] = useState<Record<string, boolean>>({});
  const captureResults = useRef<Record<string, any>>({});

  // When CaptureScreen finishes, it navigates back to PhotoFlow with completedPhotoType & captureResult
  useFocusEffect(
    useCallback(() => {
      const params = route.params as any;
      if (params?.completedPhotoType && params?.captureResult) {
        const photoType = params.completedPhotoType;
        const result    = params.captureResult;

        setDone(prev => {
          if (prev[photoType]) return prev; // already marked, skip
          return { ...prev, [photoType]: true };
        });

        captureResults.current[photoType] = result;

        // Clear the params so we don't re-process on next focus
        navigation.setParams({ completedPhotoType: undefined, captureResult: undefined });
      }
    }, [route.params]),
  );

  const completedCount = PHOTO_STEPS.filter(s => done[s.type]).length;
  const allDone = completedCount === PHOTO_STEPS.length;

  const handleCapture = (photoType: 'overview' | 'close_up' | 'measurement') => {
    navigation.navigate('Capture', {
      patientId,
      visitId,
      operatorId,
      photoType,
      returnToPhotoFlow: true, // signal CaptureScreen to return here
    });
  };

  const handleComplete = () => {
    if (!allDone) {
      const missing = PHOTO_STEPS.filter(s => !done[s.type]).map(s => s.title).join(', ');
      Alert.alert(
        'Photos Missing',
        `Please capture all 3 required photos before proceeding.\n\nMissing: ${missing}`,
        [{ text: 'OK' }],
      );
      return;
    }

    // Use measurement photo's capture result (most clinically important)
    // Fall back to last completed photo if measurement not done somehow
    const primaryResult =
      captureResults.current['measurement'] ||
      captureResults.current['close_up'] ||
      captureResults.current['overview'] ||
      {};

    navigation.navigate('Review', {
      patientId,
      visitId,
      operatorId,
      photoType: 'measurement',
      captureResponse: primaryResult.captureResponse,
      metadata: primaryResult.metadata,
      measurements: primaryResult.measurements,
    });
  };

  return (
    <ScrollView style={pf.container} contentContainerStyle={pf.content}>
      <Text style={pf.heading}>Photo Collection</Text>
      <Text style={pf.subheading}>
        All 3 photos required before submitting · {completedCount}/3 captured
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
              onPress={() => handleCapture(step.type)}>
              <Text style={[pf.captureBtnText, isDone && pf.captureBtnTextDone]}>
                {isDone ? '✓ Retake Photo' : `Capture ${step.title} →`}
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

      {/* ── Complete button ── disabled until all 3 done ─────────────── */}
      <TouchableOpacity
        style={[pf.doneBtn, !allDone && pf.doneBtnDisabled]}
        onPress={handleComplete}
        activeOpacity={allDone ? 0.8 : 1}>
        <Text style={pf.doneBtnText}>
          {allDone
            ? '✓ Review & Submit All 3 Photos'
            : `${completedCount}/3 Photos Captured — Complete All to Proceed`}
        </Text>
      </TouchableOpacity>

      {!allDone && (
        <Text style={pf.lockHint}>
          🔒 All 3 photos are clinically mandatory. Submit is locked until complete.
        </Text>
      )}

    </ScrollView>
  );
}

const W  = '#FFFFFF';
const N  = '#1F3864';
const G  = '#2ECC71';
const GR = '#F5F6FA';

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
  captureBtnDone:     { backgroundColor: '#E8F8EE', borderWidth: 1.5, borderColor: G },
  captureBtnText:     { color: W, fontWeight: '700', fontSize: 14 },
  captureBtnTextDone: { color: '#1A7F3C', fontWeight: '700', fontSize: 14 },
  stickerNote: {
    backgroundColor: '#EFF6FF', borderRadius: 10,
    padding: 14, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#2196F3',
  },
  stickerNoteTitle: { fontSize: 14, fontWeight: '700', color: '#1565C0', marginBottom: 4 },
  stickerNoteText:  { fontSize: 13, color: '#1565C0', lineHeight: 18 },
  doneBtn: {
    backgroundColor: G, borderRadius: 12,
    paddingVertical: 17, alignItems: 'center',
  },
  doneBtnDisabled:  { backgroundColor: '#AAB0C0' },
  doneBtnText:      { color: W, fontWeight: '800', fontSize: 15, textAlign: 'center', paddingHorizontal: 8 },
  lockHint: {
    fontSize: 12, color: '#888', textAlign: 'center',
    marginTop: 12, lineHeight: 18,
  },
});
