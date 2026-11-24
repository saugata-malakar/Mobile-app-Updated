import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {SubmissionRecord} from '../../types/app';
import {
  getDoctorQueue,
  resolvePhotoUri,
} from '../../services/v4WorkflowService';
import {formatShortDate, V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DoctorQueueScreen({navigation}: Props) {
  const [queue, setQueue] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const items = await getDoctorQueue();
      setQueue(items);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadQueue();
    }, [loadQueue]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadQueue();
            }}
            tintColor="#FFFFFF"
          />
        }>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.badge}>₹30 / Validation</Text>
        </View>

        <Text style={styles.title}>Doctor Validation Queue</Text>
        <Text style={styles.sub}>
          ASHA / ICDS / CHO records approved by Moderator that need your
          clinical note.
        </Text>

        {loading ? (
          <ActivityIndicator color="#60A5FA" style={{marginTop: 28}} />
        ) : queue.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No records waiting for doctor validation right now.
            </Text>
          </View>
        ) : (
          queue.map(item => (
            <View key={item.submission_id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{flex: 1}}>
                  <Text style={styles.patientTitle}>
                    {item.patient_name || 'Patient'} · {item.patient_id}
                  </Text>
                  <Text style={styles.collectorText}>
                    Collected by {item.submitted_by_name || 'Field Worker'} (
                    {item.worker_type || 'ASHA'})
                    {item.district ? ` · ${item.district}` : ''}
                  </Text>
                </View>
                <Text style={styles.timeText}>
                  {formatShortDate(item.created_at)}
                </Text>
              </View>

              <View style={styles.vitalsBox}>
                <Text style={styles.vitalsText}>
                  Age: {item.patient_age ?? '—'} yrs · Weight:{' '}
                  {item.patient_weight_kg ?? '—'} kg
                </Text>
                <Text style={styles.vitalsText}>
                  BP: {item.bp_systolic ?? item.patient_bp_systolic ?? '—'}/
                  {item.bp_diastolic ?? item.patient_bp_diastolic ?? '—'} mmHg ·
                  Sugar: {item.blood_sugar ?? item.patient_blood_sugar ?? '—'}{' '}
                  mg/dL
                </Text>
                {item.moderator_note ? (
                  <Text style={styles.modNote}>
                    Moderator note: {item.moderator_note}
                  </Text>
                ) : null}
              </View>

              {item.photos && item.photos.length > 0 && (
                <View style={styles.photosRow}>
                  {item.photos.map(p => {
                    const uri = resolvePhotoUri(p);
                    if (!uri) {
                      return null;
                    }
                    return (
                      <TouchableOpacity
                        key={p.photo_id}
                        style={styles.photoThumbWrap}
                        onPress={() => setZoomUri(uri)}>
                        <Image
                          source={{uri}}
                          style={styles.photoThumb}
                          resizeMode="cover"
                        />
                        <Text style={styles.photoLabel}>
                          #{p.photo_number} {p.photo_type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={styles.validateBtn}
                onPress={() =>
                  navigation.navigate('ClinicalNote', {
                    mode: 'validate',
                    role: 'doctor',
                    submissionId: item.submission_id,
                    patientId: item.patient_id,
                  })
                }>
                <Text style={styles.validateBtnText}>
                  Add Clinical Note & Validate (₹30) →
                </Text>
              </TouchableOpacity>
            </View>
          ))
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
    marginBottom: 12,
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
  title: {fontSize: 24, fontWeight: '900', color: V4_COLORS.text},
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: V4_COLORS.mutedText,
    marginBottom: 16,
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 20,
  },
  emptyText: {color: V4_COLORS.mutedText, fontSize: 14},
  card: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  patientTitle: {color: V4_COLORS.text, fontWeight: '900', fontSize: 15},
  collectorText: {color: '#93C5FD', fontSize: 12, marginTop: 2},
  timeText: {color: V4_COLORS.mutedText, fontSize: 11},
  vitalsBox: {
    backgroundColor: 'rgba(11, 18, 32, 0.65)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  vitalsText: {color: V4_COLORS.text, fontSize: 13, marginBottom: 2},
  modNote: {color: '#86EFAC', fontSize: 12, marginTop: 4},
  photosRow: {flexDirection: 'row', gap: 8, marginBottom: 12},
  photoThumbWrap: {flex: 1, alignItems: 'center'},
  photoThumb: {width: '100%', height: 82, borderRadius: 10},
  photoLabel: {
    marginTop: 4,
    fontSize: 10,
    color: V4_COLORS.mutedText,
    fontWeight: '700',
  },
  validateBtn: {
    backgroundColor: V4_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  validateBtnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 14},
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
