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
  getDoctorQueue,
  getMyPayments,
  getMySubmissions,
} from '../../services/v4WorkflowService';
import {formatShortDate, statusBadgeInfo, V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DoctorHomeScreen({navigation}: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [followupPatientId, setFollowupPatientId] = useState('');

  const loadDashboard = useCallback(async () => {
    const session = await getAuthSession();
    setUser(session?.user || null);
    try {
      const [subs, queue, payData] = await Promise.all([
        getMySubmissions().catch(() => []),
        getDoctorQueue().catch(() => []),
        getMyPayments().catch(() => ({payments: [], total_earned: 0, total_pending: 0})),
      ]);
      setSubmissions(subs);
      setQueueCount(queue.length);
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
      role: 'doctor',
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

  const displayName = (user?.fullName || 'Doctor').replace(/^Dr\.?\s+/i, '');

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
        {/* Header */}
        <View style={styles.topBar}>
          <View style={{flex: 1}}>
            <Text style={styles.kicker}>DOCTOR PORTAL</Text>
            <Text style={styles.welcome}>Dr. {displayName}</Text>
            {user?.specialization ? (
              <Text style={styles.spec}>{user.specialization}</Text>
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
            Direct Case: ₹80 (+₹20 helper){'\n'}ASHA Validation: ₹30
          </Text>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryAction, {backgroundColor: V4_COLORS.primary}]}
            onPress={() =>
              navigation.navigate('PatientDetailsForm', {
                role: 'doctor',
                isFollowup: false,
              })
            }>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionTitle}>New Patient Record</Text>
            <Text style={styles.actionSub}>Vitals + 3 photos + note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryAction, {backgroundColor: '#1E293B'}]}
            onPress={() => setFollowupModalOpen(true)}>
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionTitle}>Follow-up Record</Text>
            <Text style={styles.actionSub}>1-month visit by Patient ID</Text>
          </TouchableOpacity>
        </View>

        {/* Validation Queue Card */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.queueCard}
          onPress={() => navigation.navigate('DoctorQueue')}>
          <View style={{flex: 1}}>
            <Text style={styles.queueTitle}>
              🩺 In-queue to Validate (ASHA Records)
            </Text>
            <Text style={styles.queueSub}>
              Moderator-approved records needing your clinical note (₹30/case)
            </Text>
          </View>
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>{queueCount}</Text>
          </View>
        </TouchableOpacity>

        {/* Classic Command Hub Shortcut */}
        <TouchableOpacity
          style={styles.hubBtn}
          onPress={() =>
            navigation.navigate('DoctorCommandHub', {
              userRole: 'doctor',
              userProfile: user,
            })
          }>
          <Text style={styles.hubBtnText}>
            🌐 Open Clinical Command Hub →
          </Text>
        </TouchableOpacity>

        {/* My Submissions */}
        <Text style={styles.sectionTitle}>My Submissions</Text>
        {loading ? (
          <ActivityIndicator color="#60A5FA" style={{marginTop: 20}} />
        ) : submissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No submissions yet. Tap "New Patient Record" to collect your first
              case.
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
                    ? ` · Reason: ${item.ai_rejection_reason}`
                    : ''}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Follow-up Patient ID Modal */}
      <Modal
        visible={followupModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFollowupModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>1-Month Follow-up Record</Text>
            <Text style={styles.modalSub}>
              Enter the existing Patient ID to proceed directly to the 3-photo
              capture flow.
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
    color: '#60A5FA',
    letterSpacing: 1,
  },
  welcome: {fontSize: 24, fontWeight: '900', color: V4_COLORS.text, marginTop: 2},
  spec: {fontSize: 12, color: V4_COLORS.mutedText, marginTop: 2},
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
    marginBottom: 14,
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
  actionRow: {flexDirection: 'row', gap: 10, marginBottom: 14},
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
  queueCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  queueTitle: {color: V4_COLORS.text, fontWeight: '900', fontSize: 15},
  queueSub: {color: V4_COLORS.mutedText, fontSize: 12, marginTop: 3},
  queueBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: V4_COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  queueBadgeText: {color: '#0B1220', fontWeight: '900', fontSize: 16},
  hubBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  hubBtnText: {color: '#93C5FD', fontWeight: '800', fontSize: 13},
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
  emptyText: {color: V4_COLORS.mutedText, fontSize: 13, lineHeight: 19},
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
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
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
    lineHeight: 18,
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
