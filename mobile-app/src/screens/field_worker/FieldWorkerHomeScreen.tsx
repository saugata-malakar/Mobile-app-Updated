import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {CommonActions, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {SubmissionRecord, UserProfile} from '../../types/app';
import {getAuthSession, logoutV4} from '../../services/authService';
import {
  getMyPayments,
  getMySubmissions,
} from '../../services/v4WorkflowService';
import {formatShortDate, statusBadgeInfo, V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function FieldWorkerHomeScreen({navigation}: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [followupPatientId, setFollowupPatientId] = useState('');

  const loadDashboard = useCallback(async () => {
    const session = await getAuthSession();
    setUser(session?.user || null);
    try {
      const [subs, payData] = await Promise.all([
        getMySubmissions().catch(() => []),
        getMyPayments().catch(() => ({payments: [], total_earned: 0, total_pending: 0})),
      ]);
      setSubmissions(subs);
      setTotalEarned(Number(payData.total_earned || 0));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const handleLogout = async () => {
    await logoutV4();
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'PortalLogin'}]}),
    );
  };

  const startFollowupPhotos = () => {
    const pid = followupPatientId.trim();
    if (!pid) {
      Alert.alert('Patient ID Required', 'Enter the existing Patient ID.');
      return;
    }
    setFollowupModalOpen(false);
    setFollowupPatientId('');
    navigation.navigate('ThreePhotoCapture', {
      role: 'field_worker',
      patientId: pid,
      patientDetails: {
        patientName: `Follow-up (${pid})`,
        patientId: pid,
        age: 50,
        weightKg: 65,
        bpSystolic: 120,
        bpDiastolic: 80,
        bloodSugar: 140,
        comorbidities: ['Diabetes Type 2'],
        isFollowup: true,
      },
    });
  };

  const workerPrefix = user?.workerType || 'ASHA';
  const displayName = user?.fullName || 'Field Worker';

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
              loadDashboard();
            }}
            tintColor="#FFFFFF"
          />
        }>
        <View style={styles.topBar}>
          <View style={{flex: 1}}>
            <Text style={styles.kicker}>FIELD COLLECTOR PORTAL</Text>
            <Text style={styles.welcome}>
              {workerPrefix} Worker: {displayName}
            </Text>
            {user?.district ? (
              <Text style={styles.district}>District: {user.district}</Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <View>
            <Text style={styles.earningsLabel}>Total Earned</Text>
            <Text style={styles.earningsAmount}>₹{totalEarned.toFixed(0)}</Text>
          </View>
          <Text style={styles.earningsSub}>
            ₹50 Field Collector{'\n'}+ ₹20 Moderator + ₹30 Doctor = ₹100
          </Text>
        </View>

        {/* Payment / Protocol Banner */}
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>
            Intake Protocol: Collect patient details + 3 wound photos. Do not
            enter diagnosis or medication — the doctor completes that after
            moderator review.
          </Text>
        </View>

        {/* Primary Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryAction, {backgroundColor: V4_COLORS.primary}]}
            onPress={() =>
              navigation.navigate('PatientDetailsForm', {
                role: 'field_worker',
                isFollowup: false,
              })
            }>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionTitle}>New Patient Record</Text>
            <Text style={styles.actionSub}>Vitals + 3 guided photos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryAction, {backgroundColor: '#1E293B'}]}
            onPress={() => setFollowupModalOpen(true)}>
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionTitle}>Follow-up Record</Text>
            <Text style={styles.actionSub}>Same patient, 1-month visit</Text>
          </TouchableOpacity>
        </View>

        {/* My Submissions */}
        <Text style={styles.sectionTitle}>My Submissions</Text>
        {loading ? (
          <ActivityIndicator color="#60A5FA" style={{marginTop: 20}} />
        ) : submissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No submissions yet. Tap "New Patient Record" to start collecting.
            </Text>
          </View>
        ) : (
          submissions.map(item => {
            const badge = statusBadgeInfo(item.status);
            return (
              <View key={item.submission_id} style={styles.subCard}>
                <View style={styles.subTop}>
                  <View style={{flex: 1}}>
                    <Text style={styles.subPatient}>
                      {item.patient_name || 'Patient'} · {item.patient_id}
                    </Text>
                    <Text style={styles.subMeta}>
                      Age {item.patient_age ?? '—'} · BP{' '}
                      {item.bp_systolic ?? item.patient_bp_systolic ?? '—'}/
                      {item.bp_diastolic ?? item.patient_bp_diastolic ?? '—'} ·
                      Sugar{' '}
                      {item.blood_sugar ?? item.patient_blood_sugar ?? '—'} mg/dL
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, {backgroundColor: badge.bg}]}>
                    <Text style={[styles.statusText, {color: badge.color}]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.subTime}>
                  {formatShortDate(item.created_at)}
                  {item.ai_rejection_reason
                    ? ` · AI: ${item.ai_rejection_reason}`
                    : item.moderator_note
                    ? ` · Moderator: ${item.moderator_note}`
                    : ''}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Follow-up Modal */}
      <Modal
        visible={followupModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFollowupModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Follow-up Visit</Text>
            <Text style={styles.modalSub}>
              Enter the same Patient ID for the 1-month follow-up visit.
            </Text>
            <TextInput
              value={followupPatientId}
              onChangeText={setFollowupPatientId}
              autoCapitalize="characters"
              placeholder="e.g. PAT_KGP_01"
              placeholderTextColor="rgba(148,163,184,0.75)"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, {backgroundColor: '#334155'}]}
                onPress={() => setFollowupModalOpen(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, {backgroundColor: V4_COLORS.primary}]}
                onPress={startFollowupPhotos}>
                <Text style={styles.modalBtnText}>Go to Photos →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: V4_COLORS.bg},
  scroll: {padding: 18, paddingBottom: 40},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 1,
  },
  welcome: {fontSize: 21, fontWeight: '900', color: V4_COLORS.text, marginTop: 2},
  district: {fontSize: 12, color: V4_COLORS.mutedText, marginTop: 2},
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: {color: '#FCA5A5', fontWeight: '800', fontSize: 12},
  earningsCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsLabel: {color: '#86EFAC', fontSize: 12, fontWeight: '800'},
  earningsAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  earningsSub: {
    color: V4_COLORS.mutedText,
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 17,
  },
  noticeBanner: {
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    padding: 11,
    marginBottom: 14,
  },
  noticeText: {color: '#CBD5E1', fontSize: 12, lineHeight: 17},
  actionRow: {flexDirection: 'row', gap: 10, marginBottom: 20},
  primaryAction: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  actionIcon: {fontSize: 22, marginBottom: 6},
  actionTitle: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
  actionSub: {color: 'rgba(248,250,252,0.78)', fontSize: 11, marginTop: 3},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: V4_COLORS.text,
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 18,
  },
  emptyText: {color: V4_COLORS.mutedText, fontSize: 13},
  subCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  subTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  subPatient: {color: V4_COLORS.text, fontWeight: '800', fontSize: 14},
  subMeta: {color: V4_COLORS.mutedText, fontSize: 12, marginTop: 3},
  statusBadge: {paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8},
  statusText: {fontSize: 11, fontWeight: '800'},
  subTime: {color: 'rgba(148,163,184,0.85)', fontSize: 11, marginTop: 8},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: V4_COLORS.cardSolid,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  modalTitle: {color: V4_COLORS.text, fontWeight: '900', fontSize: 18},
  modalSub: {
    color: V4_COLORS.mutedText,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: V4_COLORS.text,
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 10},
  modalBtn: {paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10},
  modalBtnText: {color: '#FFFFFF', fontWeight: '800', fontSize: 13},
});
