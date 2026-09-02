// mobile-app/src/screens/ReviewScreen.tsx
// Review capture results + doctor correction of AI measurements

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
    captureResponse, annotatedImageB64, measurements,
  } = route.params;

  // ── Doctor correction state ───────────────────────────────────────────────
  const [correcting,  setCorrecting]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [correctorId, setCorrectorId] = useState(operatorId || '');

  const [corrLength,  setCorrLength]  = useState('');
  const [corrWidth,   setCorrWidth]   = useState('');
  const [corrArea,    setCorrArea]    = useState('');
  const [corrPerim,   setCorrPerim]   = useState('');
  const [corrNotes,   setCorrNotes]   = useState('');

  const m = measurements;

  // ── Submit doctor correction ──────────────────────────────────────────────
  const submitCorrection = useCallback(async () => {
    if (!m?.measurement_id) {
      Alert.alert('No measurement', 'No AI measurement to correct.');
      return;
    }
    if (!correctorId.trim()) {
      Alert.alert('Required', 'Please enter your ID/name to save correction.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: DoctorCorrectionPayload = {
        measurement_id: m.measurement_id,
        corrected_by:   correctorId,
        notes:          corrNotes || undefined,
      };
      if (corrLength) payload.length_mm   = parseFloat(corrLength);
      if (corrWidth)  payload.width_mm    = parseFloat(corrWidth);
      if (corrArea)   payload.area_cm2    = parseFloat(corrArea);
      if (corrPerim)  payload.perimeter_mm = parseFloat(corrPerim);

      await DiabetesCareAPI.correctMeasurement(payload);
      Alert.alert(
        'Correction Saved',
        'Doctor correction recorded. This will be used as the authoritative measurement.',
        [{ text: 'OK', onPress: () => navigation.navigate('Success', { patientId, visitId }) }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save correction.');
    } finally {
      setSubmitting(false);
    }
  }, [m, correctorId, corrLength, corrWidth, corrArea, corrPerim, corrNotes]);

  // ── Quality badge ──────────────────────────────────────────────────────────
  const qualityPassed = captureResponse.quality_passed;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Capture Review</Text>
          <Text style={styles.subtitle}>
            {photoType.replace('_', ' ').toUpperCase()} · Visit {visitId.slice(-8)}
          </Text>
        </View>

        {/* ── Quality badge ───────────────────────────────────────────────── */}
        <View style={[styles.badge, { backgroundColor: qualityPassed ? GREEN : ORANGE }]}>
          <Text style={styles.badgeText}>
            {qualityPassed ? '✓ Image Quality: PASS' : '⚠ Image Quality: CHECK'}
          </Text>
        </View>

        {captureResponse.warnings?.map((w, i) => (
          <View key={i} style={styles.warningRow}>
            <Text style={styles.warningText}>⚠ {w}</Text>
          </View>
        ))}

        {/* ── Annotated image ─────────────────────────────────────────────── */}
        {annotatedImageB64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${annotatedImageB64}` }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>
              {captureResponse.measurements_stored
                ? '✓ Image processed and stored securely'
                : '📷 Image stored — no measurement available'}
            </Text>
          </View>
        )}

        {/* ── AI Measurements ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Measurements</Text>

          {captureResponse.measurements_stored ? (
            <>
              <MeasurementRow label="Length"    value={m?.length_mm}   unit="mm" />
              <MeasurementRow label="Width"     value={m?.width_mm}    unit="mm" />
              <MeasurementRow label="Area"      value={m?.area_cm2}    unit="cm²" decimals={3} />
              <MeasurementRow label="Perimeter" value={m?.perimeter_mm} unit="mm" />
              {m?.confidence !== undefined && (
                <View style={styles.confidenceRow}>
                  <Text style={styles.confLabel}>Confidence</Text>
                  <View style={styles.confBar}>
                    <View
                      style={[
                        styles.confFill,
                        {
                          width: `${Math.round((m.confidence || 0) * 100)}%` as any,
                          backgroundColor:
                            (m.confidence || 0) > 0.7 ? GREEN :
                            (m.confidence || 0) > 0.4 ? ORANGE : RED,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.confValue}>
                    {Math.round((m.confidence || 0) * 100)}%
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noMeasureText}>
              {photoType === 'overview'
                ? 'Overview photos do not require measurements.'
                : 'No calibrant sticker detected — measurements unavailable.\nRetake with the blue sticker placed next to the wound.'}
            </Text>
          )}
        </View>

        {/* ── Doctor Correction ────────────────────────────────────────────── */}
        {captureResponse.measurements_stored && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.correctionHeader}
              onPress={() => setCorrecting(!correcting)}
              activeOpacity={0.7}>
              <Text style={styles.cardTitle}>Doctor Correction</Text>
              <Text style={styles.correctionToggle}>
                {correcting ? '▲ Collapse' : '▼ Correct measurements'}
              </Text>
            </TouchableOpacity>

            {correcting && (
              <>
                <Text style={styles.correctionHint}>
                  Override AI measurements if clinically inaccurate.
                  Leave blank to keep AI value.
                </Text>

                <InputRow
                  label="Your ID / Name"
                  value={correctorId}
                  onChangeText={setCorrectorId}
                  placeholder="Doctor / Nurse ID"
                  required
                />
                <InputRow
                  label="Length (mm)"
                  value={corrLength}
                  onChangeText={setCorrLength}
                  placeholder={m?.length_mm?.toFixed(1) || '—'}
                  numeric
                />
                <InputRow
                  label="Width (mm)"
                  value={corrWidth}
                  onChangeText={setCorrWidth}
                  placeholder={m?.width_mm?.toFixed(1) || '—'}
                  numeric
                />
                <InputRow
                  label="Area (cm²)"
                  value={corrArea}
                  onChangeText={setCorrArea}
                  placeholder={m?.area_cm2?.toFixed(3) || '—'}
                  numeric
                />
                <InputRow
                  label="Perimeter (mm)"
                  value={corrPerim}
                  onChangeText={setCorrPerim}
                  placeholder={m?.perimeter_mm?.toFixed(1) || '—'}
                  numeric
                />

                <Text style={styles.fieldLabel}>Clinical Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={corrNotes}
                  onChangeText={setCorrNotes}
                  placeholder="Any notes on segmentation accuracy…"
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, submitting && styles.disabled]}
                  onPress={submitCorrection}
                  disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color={WHITE} />
                    : <Text style={styles.buttonText}>Save Doctor Correction</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              navigation.navigate('Success', { patientId, visitId })
            }>
            <Text style={styles.buttonText}>Accept & Continue</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

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
    <>
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
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: GREY },
  content:             { padding: 16, paddingBottom: 40 },

  header:              { marginBottom: 12 },
  title:               { fontSize: 22, fontWeight: '800', color: NAVY },
  subtitle:            { fontSize: 13, color: '#666', marginTop: 3 },

  badge: {
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16,
    alignSelf: 'flex-start', marginBottom: 10,
  },
  badgeText:           { color: WHITE, fontWeight: '700', fontSize: 13 },

  warningRow: {
    backgroundColor: '#FFF3CD', borderRadius: 8,
    padding: 10, marginBottom: 6,
  },
  warningText:         { color: '#856404', fontSize: 13 },

  image: {
    width: '100%', height: 240,
    borderRadius: 12, marginBottom: 14,
    backgroundColor: '#000',
  },
  imagePlaceholder: {
    width: '100%', height: 120,
    borderRadius: 12, marginBottom: 14,
    backgroundColor: '#E8EAF0',
    justifyContent: 'center', alignItems: 'center',
  },
  imagePlaceholderText: { color: '#555', fontSize: 14, textAlign: 'center', padding: 16 },

  card: {
    backgroundColor: WHITE, borderRadius: 14,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  cardTitle:           { fontSize: 16, fontWeight: '700', color: NAVY, marginBottom: 12 },

  measureRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  measureLabel:        { fontSize: 14, color: '#555' },
  measureValue:        { fontSize: 14, fontWeight: '700', color: NAVY },

  confidenceRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  confLabel:           { fontSize: 13, color: '#555', width: 80 },
  confBar:             { flex: 1, height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  confFill:            { height: 8, borderRadius: 4 },
  confValue:           { fontSize: 13, color: '#555', width: 36, textAlign: 'right' },

  noMeasureText:       { fontSize: 13, color: '#666', lineHeight: 20 },

  correctionHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  correctionToggle:    { fontSize: 13, color: NAVY },
  correctionHint:      { fontSize: 12, color: '#888', marginTop: 8, marginBottom: 12, lineHeight: 18 },

  fieldLabel:          { fontSize: 13, color: '#444', fontWeight: '600', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222', backgroundColor: WHITE,
  },
  notesInput:          { height: 80, textAlignVertical: 'top' },

  actionRow:           { flexDirection: 'row', gap: 12, marginTop: 8 },
  primaryButton: {
    flex: 1, backgroundColor: NAVY, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
  },
  secondaryButton: {
    flex: 1, borderWidth: 1.5, borderColor: NAVY, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
  },
  buttonText:          { color: WHITE, fontWeight: '700', fontSize: 15 },
  secondaryButtonText: { color: NAVY, fontWeight: '700', fontSize: 15 },
  disabled:            { opacity: 0.5 },
});
