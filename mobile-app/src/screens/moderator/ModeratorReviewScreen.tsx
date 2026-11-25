import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {SubmissionRecord} from '../../types/app';
import {
  approveModeratorSubmission,
  getSubmissionDetail,
  rejectModeratorSubmission,
  resolvePhotoUri,
} from '../../services/v4WorkflowService';
import {V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'ModeratorReview'>;
};

const REJECT_REASONS = [
  'Blurry or out-of-focus photos',
  'Coin reference missing',
  'Poor lighting / heavy shadows',
  'Incomplete 3-photo protocol',
  'Duplicate or altered image',
];

export default function ModeratorReviewScreen({navigation, route}: Props) {
  const initialSub = (route.params as any)?.submission as SubmissionRecord;
  const [sub, setSub] = useState<SubmissionRecord>(initialSub);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialSub?.submission_id && (!initialSub.photos || initialSub.photos.length === 0)) {
      getSubmissionDetail(initialSub.submission_id)
        .then(detail => setSub(detail))
        .catch(() => {});
    }
  }, [initialSub]);

  const handleApprove = async () => {
    setBusy(true);
    try {
      await approveModeratorSubmission(sub.submission_id, 'Approved by moderator');
      Alert.alert(
        'Approved ✓',
        '₹20 credited to your account. Record forwarded to Doctor validation queue.',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not approve submission.');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please enter or select a rejection reason.');
      return;
    }
    setBusy(true);
    try {
      await rejectModeratorSubmission(sub.submission_id, rejectReason.trim());
      Alert.alert(
        'Submission Rejected',
        'Rejection reason recorded. Field collector will be notified.',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not reject submission.');
    } finally {
      setBusy(false);
    }
  };

  const comorbidities =
    sub.patient_comorbidities || sub.comorbidities || [];
  const isPending = sub.status === 'ai_reviewed';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.badge}>₹20 on Approve</Text>
        </View>

        <Text style={styles.title}>Moderator Review</Text>

        {/* Field Worker & Patient Details */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Collector & Patient Details</Text>
          <Text style={styles.line}>
            Patient:{' '}
            <Text style={styles.bold}>
              {sub.patient_name || 'Patient'} ({sub.patient_id})
            </Text>
          </Text>
          <Text style={styles.line}>
            Field Worker:{' '}
            <Text style={styles.bold}>
              {sub.submitted_by_name || 'Field Worker'} (
              {sub.worker_type || 'ASHA'})
            </Text>
          </Text>
          {sub.district ? (
            <Text style={styles.line}>District: {sub.district}</Text>
          ) : null}
          <Text style={styles.line}>
            Age / Weight:{' '}
            <Text style={styles.bold}>
              {sub.patient_age ?? '—'} yrs · {sub.patient_weight_kg ?? '—'} kg
            </Text>
          </Text>
          <Text style={styles.line}>
            BP:{' '}
            <Text style={styles.bold}>
              {sub.bp_systolic ?? sub.patient_bp_systolic ?? '—'}/
              {sub.bp_diastolic ?? sub.patient_bp_diastolic ?? '—'} mmHg
            </Text>{' '}
            · Blood Sugar:{' '}
            <Text style={styles.bold}>
              {sub.blood_sugar ?? sub.patient_blood_sugar ?? '—'} mg/dL
            </Text>
          </Text>
          {Array.isArray(comorbidities) && comorbidities.length > 0 && (
            <Text style={styles.line}>
              Comorbidities: {comorbidities.join(', ')}
            </Text>
          )}
          {sub.ai_quality_score != null && (
            <Text style={styles.aiScore}>
              AI Quality Score:{' '}
              {Number(sub.ai_quality_score) <= 1
                ? Math.round(Number(sub.ai_quality_score) * 100)
                : Math.round(Number(sub.ai_quality_score))}
              %
            </Text>
          )}
        </View>

        {/* 3 Zoomable Photos */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>
            3 Wound Photos (Tap to Zoom)
          </Text>
          {!sub.photos || sub.photos.length === 0 ? (
            <Text style={styles.muted}>Loading photos…</Text>
          ) : (
            sub.photos.map(p => {
              const uri = resolvePhotoUri(p);
              return (
                <TouchableOpacity
                  key={p.photo_id}
                  activeOpacity={0.9}
                  style={styles.photoCard}
                  onPress={() => uri && setZoomUri(uri)}>
                  {uri ? (
                    <Image
                      source={{uri}}
                      style={styles.photoImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.muted}>Photo unavailable</Text>
                    </View>
                  )}
                  <View style={styles.photoFooter}>
                    <Text style={styles.photoTitle}>
                      Photo #{p.photo_number} · {p.photo_type}
                    </Text>
                    <Text style={styles.zoomLink}>Tap to Zoom 🔍</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {isPending && (
          <>
            {showRejectBox && (
              <View style={styles.rejectBox}>
                <Text style={styles.cardHeading}>Rejection Reason *</Text>
                <View style={styles.chipsWrap}>
                  {REJECT_REASONS.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={styles.reasonChip}
                      onPress={() => setRejectReason(r)}>
                      <Text style={styles.reasonChipText}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  placeholder="Type rejection reason..."
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  style={styles.rejectInput}
                />
                <TouchableOpacity
                  disabled={busy}
                  style={styles.confirmRejectBtn}
                  onPress={handleReject}>
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnText}>Confirm Reject ✗</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                disabled={busy}
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => setShowRejectBox(v => !v)}>
                <Text style={styles.btnText}>
                  {showRejectBox ? 'Hide Reject' : 'Reject ✗'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={busy}
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={handleApprove}>
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnText}>Approve (₹20) ✓</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(zoomUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomUri(null)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.zoomBackdrop}
          onPress={() => setZoomUri(null)}>
          {zoomUri && (
            <Image
              source={{uri: zoomUri}}
              style={styles.zoomImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.zoomHint}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
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
    marginBottom: 10,
  },
  backText: {color: '#93C5FD', fontSize: 15, fontWeight: '800'},
  badge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {fontSize: 24, fontWeight: '900', color: V4_COLORS.text, marginBottom: 14},
  card: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: '#60A5FA',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  line: {fontSize: 14, color: V4_COLORS.text, marginBottom: 4},
  bold: {fontWeight: '800', color: '#FFFFFF'},
  aiScore: {marginTop: 6, color: '#86EFAC', fontWeight: '800', fontSize: 13},
  muted: {color: V4_COLORS.mutedText, fontSize: 13},
  photoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    marginBottom: 10,
    backgroundColor: '#020617',
  },
  photoImg: {width: '100%', height: 190},
  photoPlaceholder: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  photoTitle: {color: V4_COLORS.text, fontWeight: '800', fontSize: 13},
  zoomLink: {color: '#93C5FD', fontWeight: '700', fontSize: 12},
  rejectBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    padding: 14,
    marginBottom: 14,
  },
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10},
  reasonChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  reasonChipText: {color: '#FCA5A5', fontSize: 11, fontWeight: '700'},
  rejectInput: {
    minHeight: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
    padding: 10,
    color: V4_COLORS.text,
    marginBottom: 10,
  },
  confirmRejectBtn: {
    backgroundColor: V4_COLORS.danger,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionsRow: {flexDirection: 'row', gap: 12},
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  rejectBtn: {backgroundColor: V4_COLORS.danger},
  approveBtn: {backgroundColor: V4_COLORS.success},
  btnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  zoomImage: {width: '100%', height: '78%'},
  zoomHint: {color: '#CBD5E1', marginTop: 14, fontWeight: '700'},
});
