// mobile-app/src/screens/CaptureScreen.tsx
// Camera screen with live viewfinder guidance for ASHA workers

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Vibration, Platform,
} from 'react-native';
import { Camera, useCameraDevices, PhotoFile } from 'react-native-vision-camera';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';
import Geolocation from '@react-native-community/geolocation';

import { DiabetesCareAPI, GuidanceResponse } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type CaptureRouteProp = RouteProp<RootStackParamList, 'Capture'>;

// ── Colours ────────────────────────────────────────────────────────────────
const GREEN  = '#2ECC71';
const ORANGE = '#F39C12';
const RED    = '#E74C3C';
const NAVY   = '#1F3864';
const WHITE  = '#FFFFFF';

// ── Photo type labels ──────────────────────────────────────────────────────
const PHOTO_TYPE_LABELS: Record<string, string> = {
  overview:    '1. Overview Photo',
  close_up:    '2. Close-Up Photo',
  measurement: '3. Measurement Photo (with sticker)',
};

const PHOTO_TYPE_HINTS: Record<string, string> = {
  overview:
    'Capture the full limb/area for clinical context. No sticker needed.',
  close_up:
    'Close-up of the wound. Fill the frame with the wound area.',
  measurement:
    'Place the blue calibrant sticker on intact skin next to the wound before capturing.',
};

export default function CaptureScreen() {
  const navigation  = useNavigation<any>();
  const route       = useRoute<CaptureRouteProp>();
  const { patientId, visitId, photoType, operatorId } = route.params;

  const camera      = useRef<Camera>(null);
  const devices     = useCameraDevices();
  const device      = devices.back;

  const [guidance, setGuidance]     = useState<GuidanceResponse | null>(null);
  const [capturing, setCapturing]   = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [location, setLocation]     = useState<{ lat: number; lon: number } | null>(null);

  // ── Permissions ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();

    Geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  // ── Live guidance (poll every 1.5s via server) ────────────────────────────
  // In production: run OpenCV locally on device. For prototype: server-side.
  useEffect(() => {
    if (!hasPermission) return;
    const interval = setInterval(async () => {
      if (capturing || processing || !camera.current) return;
      try {
        // Take a low-quality preview snapshot
        const snap = await camera.current.takeSnapshot({ quality: 30 });
        const b64  = await fileToBase64(snap.path);
        const g    = await DiabetesCareAPI.getGuidance(b64);
        setGuidance(g);
        if (g.ready) Vibration.vibrate(50);
      } catch {
        // Guidance is best-effort — never block the user
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [hasPermission, capturing, processing]);

  // ── Capture ───────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!camera.current || capturing || processing) return;
    setCapturing(true);
    Vibration.vibrate(100);

    try {
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: 'off',
        enableAutoRedEyeReduction: false,
      });

      setCapturing(false);
      setProcessing(true);

      const deviceModel = await DeviceInfo.getModel();
      const b64         = await fileToBase64(photo.path);

      // Send to backend for processing
      const response = await DiabetesCareAPI.processLocal(
        b64,
        patientId,
        visitId,
        photoType,
        undefined,
        operatorId,
      );

      setProcessing(false);

      // Navigate to review screen
      navigation.navigate('Review', {
        patientId,
        visitId,
        photoType,
        operatorId,
        captureResponse: response,
        annotatedImageB64: '',   // returned from full pipeline
        measurements: {
          length_mm:   undefined,
          width_mm:    undefined,
          area_cm2:    undefined,
          perimeter_mm: undefined,
          confidence:  undefined,
          measurement_id: response.measurement_id,
        },
      });

    } catch (err: any) {
      setCapturing(false);
      setProcessing(false);
      Alert.alert(
        'Capture Failed',
        err.message || 'Could not process image. Please try again.',
        [{ text: 'OK' }],
      );
    }
  }, [capturing, processing, patientId, visitId, photoType, operatorId]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Camera permission required.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => Camera.requestCameraPermission()}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={NAVY} />
        <Text style={styles.loadingText}>Initialising camera…</Text>
      </View>
    );
  }

  const progressColor =
    !guidance         ? ORANGE :
    guidance.ready    ? GREEN  :
    guidance.progress_pct > 50 ? ORANGE : RED;

  return (
    <View style={styles.container}>
      {/* ── Camera Viewfinder ──────────────────────────────────────────── */}
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!processing}
        photo={true}
        enableZoomGesture
      />

      {/* ── Top bar: photo type label ───────────────────────────────────── */}
      <View style={styles.topBar}>
        <Text style={styles.photoTypeLabel}>
          {PHOTO_TYPE_LABELS[photoType] || photoType}
        </Text>
        <Text style={styles.photoTypeHint}>
          {PHOTO_TYPE_HINTS[photoType] || ''}
        </Text>
      </View>

      {/* ── Guidance overlay ────────────────────────────────────────────── */}
      {guidance && (
        <View style={styles.guidanceContainer}>
          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${guidance.progress_pct}%` as any,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>

          {/* Status icons row */}
          <View style={styles.statusRow}>
            <StatusPill
              label="Light"
              ok={guidance.brightness_status === 'ok'}
              icon="☀️"
            />
            <StatusPill
              label="Focus"
              ok={guidance.blur_status === 'ok'}
              icon="🎯"
            />
            <StatusPill
              label="Sticker"
              ok={guidance.sticker_status === 'found'}
              icon="🔵"
            />
            <StatusPill
              label="Distance"
              ok={guidance.distance_status === 'ok'}
              icon="📏"
            />
          </View>

          {/* Instruction text */}
          {guidance.instructions.length > 0 && (
            <View style={styles.instructionBox}>
              {guidance.instructions.map((inst, i) => (
                <Text key={i} style={styles.instructionText}>
                  • {inst}
                </Text>
              ))}
            </View>
          )}

          {/* Ready badge */}
          {guidance.ready && (
            <View style={styles.readyBadge}>
              <Text style={styles.readyText}>✓ READY TO CAPTURE</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Processing overlay ──────────────────────────────────────────── */}
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={WHITE} />
          <Text style={styles.processingText}>Analysing wound…</Text>
          <Text style={styles.processingSubtext}>
            Detecting sticker · Measuring · Segmenting
          </Text>
        </View>
      )}

      {/* ── Capture button ──────────────────────────────────────────────── */}
      {!processing && (
        <View style={styles.captureRow}>
          <TouchableOpacity
            style={[
              styles.captureButton,
              { opacity: capturing ? 0.5 : 1 },
            ]}
            onPress={handleCapture}
            disabled={capturing}
            activeOpacity={0.8}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Sub-component: status pill ─────────────────────────────────────────────
function StatusPill({
  label, ok, icon,
}: { label: string; ok: boolean; icon: string }) {
  return (
    <View style={[styles.pill, { borderColor: ok ? GREEN : RED }]}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={[styles.pillLabel, { color: ok ? GREEN : RED }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function fileToBase64(filePath: string): Promise<string> {
  const RNFS = require('react-native-fs');
  return RNFS.readFile(filePath, 'base64');
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#000' },
  centered:            { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText:           { fontSize: 16, color: RED, marginBottom: 16, textAlign: 'center' },
  loadingText:         { fontSize: 14, color: '#666', marginTop: 12 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(31,56,100,0.85)',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12, paddingHorizontal: 20,
  },
  photoTypeLabel:      { color: WHITE, fontSize: 17, fontWeight: '700' },
  photoTypeHint:       { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },

  guidanceContainer: {
    position: 'absolute', bottom: 130, left: 16, right: 16,
  },
  progressBar: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, marginBottom: 10, overflow: 'hidden',
  },
  progressFill:        { height: 6, borderRadius: 3 },

  statusRow:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pill: {
    flex: 1, marginHorizontal: 3,
    borderWidth: 1.5, borderRadius: 20,
    paddingVertical: 5, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pillIcon:            { fontSize: 14 },
  pillLabel:           { fontSize: 10, fontWeight: '600', marginTop: 1 },

  instructionBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  instructionText:     { color: WHITE, fontSize: 13, marginBottom: 3 },

  readyBadge: {
    backgroundColor: GREEN, borderRadius: 20,
    paddingVertical: 8, alignItems: 'center',
  },
  readyText:           { color: WHITE, fontWeight: '800', fontSize: 14, letterSpacing: 1 },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  processingText:      { color: WHITE, fontSize: 18, fontWeight: '700', marginTop: 16 },
  processingSubtext:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 },

  captureRow: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: WHITE,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  captureInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: WHITE,
  },

  primaryButton: {
    backgroundColor: NAVY, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 32, marginTop: 12,
  },
  buttonText:          { color: WHITE, fontWeight: '700', fontSize: 15 },
});
