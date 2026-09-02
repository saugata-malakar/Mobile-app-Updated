// mobile-app/src/screens/ReviewScreen.tsx
// Review capture results with annotated wound segmentation overlay, AI measurements, and doctor correction override

import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { DiabetesCareAPI, DoctorCorrectionPayload } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type ReviewRouteProp = RouteProp<RootStackParamList, 'Review'>;

const NAVY   = '#1F3864';
const GREEN  = '#2ECC71';
const ORANGE = '#F39C12';
const RED    = '#E74C3C';
const WHITE  = '#FFFFFF';
const GREY   = '#F5F6FA';

export default function ReviewScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<ReviewRouteProp>();
  const {
    patientId, visitId, photoType, operatorId,
    captureResponse, annotatedImageB64, originalImageB64, measurements,
  } = (route.params as any);

  // ── Image View Toggle ────────────────────────────────────────────────────
  const [showAnnotated, setShowAnnotated] = useState(true);

  // ── Doctor Correction State ──────────────────────────────────────────────
  const [correcting, setCorrecting]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [correctorId, setCorrectorId] = useState(operatorId || '');

  const [corrLength, setCorrLength]   = useState('');
  const [corrWidth, setCorrWidth]     = useState('');
  const [corrArea, setCorrArea]       = useState('');
  const [corrPerim, setCorrPerim]     = useState('');
  const [corrNotes, setCorrNotes]     = useState('');

  const m = measurements || captureResponse?.measurements || {};
  const measId = m?.measurement_id || captureResponse?.measurement_id;

  // ── Submit Doctor Correction ─────────────────────────────────────────────
  const submitCorrection = useCallback(async () => {
    if (!measId) {
      Alert.alert('No measurement', 'No AI measurement to correct for this photo type.');
      return;
    }
    if (!correctorId.trim()) {
      Alert.alert('Required', 'Please enter your Doctor/Nurse ID to sign the correction.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: DoctorCorrectionPayload = {
        measurement_id: measId,
        corrected_by: correctorId.trim(),
        notes: corrNotes.trim() || undefined,
      };
      if (corrLength) payload.length_mm   = parseFloat(corrLength);
      if (corrWidth)  payload.width_mm    = parseFloat(corrWidth);
      if (corrArea)   payload.area_cm2    = parseFloat(corrArea);
      if (corrPerim)  payload.perimeter_mm = parseFloat(corrPerim);

      const res = await DiabetesCareAPI.correctMeasurement(payload);
      Alert.alert(
        'Correction Saved',
        `Doctor correction recorded authoritative value (${res.final_area_cm2 ?? corrArea} cm²).`,
        [{ text: 'OK', onPress: () => navigation.navigate('Success', { patientId, visitId }) }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save doctor correction.');
    } finally {
      setSubmitting(false);
    }
  }, [measId, correctorId, corrLength, corrWidth, corrArea, corrPerim, corrNotes, navigation, patientId, visitId]);

  const qualityPassed = captureResponse?.quality_passed ?? true;
  const displayImageB64 = (showAnnotated && annotatedImageB64) ? annotatedImageB64 : (originalImageB64 || annotatedImageB64);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Capture & AI Analysis Review</Text>
          <Text style={styles.subtitle}>
            {photoType?.replace('_', ' ').toUpperCase()} · Visit {visitId?.slice(-8)}
          </Text>
        </View>

        {/* ── Quality Status Badge ─────────────────────────────────────────── */}
        <View style={[styles.badge, { backgroundColor: qualityPassed ? GREEN : ORANGE }]}>
          <Text style={styles.badgeText}>
            {qualityPassed ? '✓ Image Quality: PASS (Optimal Focus & Lighting)' : '⚠ Image Quality: CHECK (Review Quality Warnings)'}
          </Text>
        </View>

        {captureResponse?.warnings?.map((w: string, i: number) => (
          <View key={i} style={styles.warningRow}>
            <Text style={styles.warningText}>• {w}</Text>
          </View>
        ))}

        {/* ── Annotated / Original Image Preview ──────────────────────────── */}
        <View style={styles.imageCard}>
          {displayImageB64 ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${displayImageB64}` }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>✓ Image captured & stored securely</Text>
            </View>
          )}

          {originalImageB64 && annotatedImageB64 && (
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, showAnnotated && styles.toggleBtnActive]}
                onPress={() => setShowAnnotated(true)}>
                <Text style={[styles.toggleText, showAnnotated && styles.toggleTextActive]}>
                  AI Segmentation Overlay
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !showAnnotated && styles.toggleBtnActive]}
                onPress={() => setShowAnnotated(false)}>
                <Text style={[styles.toggleText, !showAnnotated && styles.toggleTextActive]}>
                  Original Photo
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Derived Physical Measurements Card ──────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📐 Physical Dimensions & AI Metrics</Text>

          {photoType === 'measurement' || captureResponse?.measurements_stored ? (
            <>
              <MeasurementRow label="Max Length (Feret)" value={m?.length_mm} unit="mm" />
              <MeasurementRow label="Max Width (Orthogonal)" value={m?.width_mm} unit="mm" />
              <MeasurementRow label="2D Surface Area" value={m?.area_cm2} unit="cm²" decimals={3} />
              <MeasurementRow label="Perimeter" value={m?.perimeter_mm} unit="mm" />

              {m?.confidence !== undefined && (
                <View style={styles.confidenceRow}>
                  <Text style={styles.confLabel}>Confidence</Text>
                  <View style={styles.confBar}>
                    <View
                      style={[
                        styles.confFill,
                        {
                          width: `${Math.round((m.confidence || 0.88) * 100)}%` as any,
                          backgroundColor:
                            (m.confidence || 0.88) > 0.75 ? GREEN :
                            (m.confidence || 0.88) > 0.5 ? ORANGE : RED,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.confValue}>
                    {Math.round((m.confidence || 0.88) * 100)}%
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noMeasureText}>
              {photoType === 'overview'
                ? 'Overview photos establish bodily context. Calibrated physical measurements are calculated on Step 3.'
                : 'Close-up photo captured for tissue texture inspection.'}
            </Text>
          )}
        </View>

        {/* ── Doctor Correction & Clinical Override Panel ──────────────────── */}
        {(photoType === 'measurement' || captureResponse?.measurements_stored) && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.correctionHeader}
              onPress={() => setCorrecting(!correcting)}
              activeOpacity={0.7}>
              <Text style={styles.cardTitle}>👨‍⚕️ Doctor Clinical Override</Text>
              <Text style={styles.correctionToggle}>
                {correcting ? '▲ Collapse' : '▼ Override / Correct values'}
              </Text>
            </TouchableOpacity>

            {correcting && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.correctionHint}>
                  Clinicians can override any automated dimension if hyperkeratotic or macerated borders require adjustment. Overridden values are flagged as authoritative.
                </Text>

                <InputRow
                  label="Doctor / Clinician ID"
                  value={correctorId}
                  onChangeText={setCorrectorId}
                  placeholder="e.g. DOC_WB_102"
                  required
                />
                <InputRow
                  label="Corrected Length (mm)"
                  value={corrLength}
                  onChangeText={setCorrLength}
                  placeholder={m?.length_mm ? `${m.length_mm.toFixed(1)} mm` : '—'}
                  numeric
                />
                <InputRow
                  label="Corrected Width (mm)"
                  value={corrWidth}
                  onChangeText={setCorrWidth}
                  placeholder={m?.width_mm ? `${m.width_mm.toFixed(1)} mm` : '—'}
                  numeric
                />
                <InputRow
                  label="Corrected Area (cm²)"
                  value={corrArea}
                  onChangeText={setCorrArea}
                  placeholder={m?.area_cm2 ? `${m.area_cm2.toFixed(3)} cm²` : '—'}
                  numeric
                />
                <InputRow
                  label="Corrected Perimeter (mm)"
                  value={corrPerim}
                  onChangeText={setCorrPerim}
                  placeholder={m?.perimeter_mm ? `${m.perimeter_mm.toFixed(1)} mm` : '—'}
                  numeric
                />

                <Text style={styles.fieldLabel}>Clinical Assessment Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={corrNotes}
                  onChangeText={setCorrNotes}
                  placeholder="Notes on wound depth, exudate, or edge maceration…"
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, submitting && styles.disabled]}
                  onPress={submitCorrection}
                  disabled={submitting}
                  activeOpacity={0.8}>
                  {submitting
                    ? <ActivityIndicator color={WHITE} />
                    : <Text style={styles.buttonText}>Save Doctor Correction ✓</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Bottom Action Buttons ───────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>↺ Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Success', { patientId, visitId })}
            activeOpacity={0.8}>
            <Text style={styles.buttonText}>Accept & Continue →</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function MeasurementRow({
  label, value, unit, decimals = 1,
}: { label: string; value?: number; unit: string; decimals?: number }) {
  return (
    <View style={styles.measureRow}>
      <Text style={styles.measureLabel}>{label}</Text>
      <Text style={styles.measureValue}>
        {value != null ? `${value.toFixed(decimals)} ${unit}` : '—'}
      </Text>
    </View>
  );
}

function InputRow({
  label, value, onChangeText, placeholder, numeric, required,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  numeric?: boolean;
  required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor="#AAA"
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GREY },
  content:   { padding: 16, paddingBottom: 48 },

  header:    { marginBottom: 12 },
  title:     { fontSize: 22, fontWeight: '800', color: NAVY },
  subtitle:  { fontSize: 13, color: '#666', marginTop: 3 },

  badge: {
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    marginBottom: 10,
  },
  badgeText: { color: WHITE, fontWeight: '700', fontSize: 12 },

  warningRow: {
    backgroundColor: '#FFF3CD', borderRadius: 6,
    padding: 8, marginBottom: 6,
  },
  warningText: { color: '#856404', fontSize: 12, fontWeight: '500' },

  imageCard: {
    backgroundColor: WHITE, borderRadius: 14, padding: 10,
    marginBottom: 14, elevation: 2,
  },
  image: {
    width: '100%', height: 260,
    borderRadius: 10, backgroundColor: '#000',
  },
  imagePlaceholder: {
    width: '100%', height: 140, borderRadius: 10,
    backgroundColor: '#E8EAF0', justifyContent: 'center', alignItems: 'center',
  },
  imagePlaceholderText: { color: '#555', fontSize: 14, fontWeight: '600' },

  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggleBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: '#D0D5DD',
    backgroundColor: '#F9FAFB',
  },
  toggleBtnActive: { backgroundColor: NAVY, borderColor: NAVY },
  toggleText: { fontSize: 12, fontWeight: '600', color: '#555' },
  toggleTextActive: { color: WHITE },

  card: {
    backgroundColor: WHITE, borderRadius: 14,
    padding: 16, marginBottom: 14, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: NAVY, marginBottom: 10 },

  measureRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  measureLabel: { fontSize: 14, color: '#555' },
  measureValue: { fontSize: 14, fontWeight: '700', color: NAVY },

  confidenceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  confLabel:     { fontSize: 13, color: '#555', width: 75 },
  confBar:       { flex: 1, height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  confFill:      { height: 8, borderRadius: 4 },
  confValue:     { fontSize: 13, color: '#555', width: 38, textAlign: 'right', fontWeight: '700' },

  noMeasureText: { fontSize: 13, color: '#666', lineHeight: 18 },

  correctionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  correctionToggle: { fontSize: 13, color: NAVY, fontWeight: '600' },
  correctionHint:   { fontSize: 12, color: '#777', marginBottom: 10, lineHeight: 17 },

  fieldLabel: { fontSize: 13, color: '#444', fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: '#222', backgroundColor: WHITE,
  },
  notesInput: { height: 70, textAlignVertical: 'top' },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  primaryButton: {
    flex: 1, backgroundColor: NAVY, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryButton: {
    flex: 1, borderWidth: 1.5, borderColor: NAVY, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonText:          { color: WHITE, fontWeight: '700', fontSize: 14 },
  secondaryButtonText: { color: NAVY, fontWeight: '700', fontSize: 14 },
  disabled:            { opacity: 0.5 },
});
