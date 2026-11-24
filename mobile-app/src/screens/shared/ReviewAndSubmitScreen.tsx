import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {
  AppRole,
  CapturedPhoto,
  ClinicalNoteDraft,
  MedicalReportFile,
  PatientDetailsDraft,
} from '../../types/app';
import {submitForAiCheck} from '../../services/v4WorkflowService';
import {V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'ReviewAndSubmit'>;
};

export default function ReviewAndSubmitScreen({navigation, route}: Props) {
  const params = (route.params || {}) as {
    role: AppRole;
    submissionId: string;
    patientId?: string;
    patientDetails: PatientDetailsDraft;
    photos: CapturedPhoto[];
    reports?: MedicalReportFile[];
    clinicalNote?: ClinicalNoteDraft;
  };

  const {
    role,
    submissionId,
    patientId,
    patientDetails,
    photos = [],
    reports = [],
    clinicalNote,
  } = params;

  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const result = await submitForAiCheck(submissionId);
      navigation.replace('SubmissionResult', {
        role,
        submission: result,
      });
    } catch (err: any) {
      Alert.alert(
        'Submission Error',
        err?.message || 'Could not complete final submission.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.stepPill}>Final Review</Text>
        </View>

        <Text style={styles.title}>Review & Submit</Text>
        <Text style={styles.sub}>
          Verify all patient details and photos before running the AI quality
          check.
        </Text>

        {/* Patient Details Summary */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Patient Details</Text>
          <Text style={styles.rowText}>
            Name: <Text style={styles.bold}>{patientDetails.patientName}</Text>
          </Text>
          {patientId ? (
            <Text style={styles.rowText}>
              Patient ID: <Text style={styles.bold}>{patientId}</Text>
            </Text>
          ) : null}
          <Text style={styles.rowText}>
            Age / Weight:{' '}
            <Text style={styles.bold}>
              {patientDetails.age} yrs · {patientDetails.weightKg} kg
            </Text>
          </Text>
          <Text style={styles.rowText}>
            BP:{' '}
            <Text style={styles.bold}>
              {patientDetails.bpSystolic}/{patientDetails.bpDiastolic} mmHg
            </Text>{' '}
            · Sugar:{' '}
            <Text style={styles.bold}>{patientDetails.bloodSugar} mg/dL</Text>
          </Text>
          {patientDetails.comorbidities?.length > 0 && (
            <Text style={styles.rowText}>
              Comorbidities:{' '}
              <Text style={styles.bold}>
                {patientDetails.comorbidities.join(', ')}
              </Text>
            </Text>
          )}
        </View>

        {/* 3 Photo Thumbnails */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>3 Wound Photos</Text>
          <View style={styles.thumbsRow}>
            {photos.map(p => (
              <View key={p.photoNumber} style={styles.thumbWrap}>
                <Image
                  source={{uri: p.uri}}
                  style={styles.thumbImg}
                  resizeMode="cover"
                />
                <Text style={styles.thumbLabel}>
                  #{p.photoNumber} {p.photoType}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Doctor-only Clinical Note & Reports OR Field Worker notice */}
        {role === 'doctor' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                Previous Medical Reports ({reports.length})
              </Text>
              {reports.length === 0 ? (
                <Text style={styles.mutedLine}>No reports attached (optional).</Text>
              ) : (
                reports.map(r => (
                  <Text key={r.id} style={styles.rowText}>
                    📄 {r.fileName}
                  </Text>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeading}>Clinical Note</Text>
              <Text style={styles.rowText}>{clinicalNote?.diagnosis}</Text>
              {clinicalNote?.severity ? (
                <Text style={styles.mutedLine}>
                  Severity: {clinicalNote.severity}
                </Text>
              ) : null}
              {clinicalNote?.treatmentNeeded ? (
                <Text style={styles.mutedLine}>
                  Treatment: {clinicalNote.treatmentNeeded}
                </Text>
              ) : null}
              {clinicalNote?.medication ? (
                <Text style={styles.mutedLine}>
                  Medication: {clinicalNote.medication}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerTitle}>Field Collector Protocol</Text>
            <Text style={styles.infoBannerText}>
              No diagnosis, severity, treatment, or medication is entered by
              ASHA/ICDS/CHO workers. A moderator and doctor will review your
              record after submission.
            </Text>
          </View>
        )}

        {/* Immutable Warning */}
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠ Once submitted, photos cannot be edited
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={busy}
          style={[styles.submitBtn, busy && {opacity: 0.6}]}
          onPress={handleSubmit}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Submit & Run AI Quality Check</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: V4_COLORS.bg},
  scroll: {padding: 18, paddingBottom: 40},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {color: '#93C5FD', fontSize: 15, fontWeight: '800'},
  stepPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    color: '#93C5FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {fontSize: 24, fontWeight: '900', color: V4_COLORS.text},
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: V4_COLORS.mutedText,
    marginBottom: 14,
  },
  card: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  cardHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#60A5FA',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  rowText: {
    fontSize: 14,
    color: V4_COLORS.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  mutedLine: {fontSize: 13, color: V4_COLORS.mutedText, marginTop: 2},
  bold: {fontWeight: '800', color: '#FFFFFF'},
  thumbsRow: {flexDirection: 'row', gap: 10},
  thumbWrap: {flex: 1, alignItems: 'center'},
  thumbImg: {width: '100%', height: 84, borderRadius: 10},
  thumbLabel: {
    marginTop: 4,
    fontSize: 11,
    color: V4_COLORS.mutedText,
    fontWeight: '700',
  },
  infoBanner: {
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    padding: 12,
    marginBottom: 12,
  },
  infoBannerTitle: {
    color: '#93C5FD',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 4,
  },
  infoBannerText: {color: V4_COLORS.mutedText, fontSize: 12, lineHeight: 17},
  warningBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#FCD34D',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: V4_COLORS.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {color: '#FFFFFF', fontWeight: '900', fontSize: 16},
});
