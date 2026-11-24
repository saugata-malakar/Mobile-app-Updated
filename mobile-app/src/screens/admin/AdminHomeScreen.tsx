import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import type {
  AdminStats,
  AdminUserItem,
  PaymentItem,
  SubmissionRecord,
  UserProfile,
} from '../../types/app';
import {getAuthSession, logoutV4} from '../../services/authService';
import {
  getAdminPayments,
  getAdminStats,
  getAdminSubmissions,
  getAdminUsers,
  getSubmissionDetail,
  markAdminPaymentPaid,
  overrideAdminSubmission,
  resolvePhotoUri,
  updateAdminUser,
} from '../../services/v4WorkflowService';
import {formatShortDate, statusBadgeInfo, V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type AdminTab = 'overview' | 'users' | 'submissions' | 'payments';

export default function AdminHomeScreen({navigation}: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectSub, setInspectSub] = useState<SubmissionRecord | null>(null);

  const loadAll = useCallback(async () => {
    const session = await getAuthSession();
    setUser(session?.user || null);
    try {
      const [s, u, subs, pays] = await Promise.all([
        getAdminStats().catch(() => null),
        getAdminUsers(roleFilter || undefined, searchQuery || undefined).catch(
          () => [],
        ),
        getAdminSubmissions(
          statusFilter || undefined,
          roleFilter || undefined,
          searchQuery || undefined,
        ).catch(() => []),
        getAdminPayments(
          roleFilter || undefined,
          statusFilter || undefined,
        ).catch(() => []),
      ]);
      setStats(s);
      setUsers(u);
      setSubmissions(subs);
      setPayments(pays);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, statusFilter, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const handleLogout = async () => {
    await logoutV4();
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'PortalLogin'}]}),
    );
  };

  const toggleUserStatus = async (item: AdminUserItem) => {
    const currentlyActive =
      item.status ? item.status === 'active' : item.is_active !== false;
    const nextStatus = currentlyActive ? 'suspended' : 'active';
    try {
      await updateAdminUser(item.user_id, {status: nextStatus});
      loadAll();
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update user.');
    }
  };

  const openInspect = async (sub: SubmissionRecord) => {
    setInspectSub(sub);
    try {
      const full = await getSubmissionDetail(sub.submission_id);
      setInspectSub(full);
    } catch {
      // keep summary
    }
  };

  const handleOverride = async (
    submissionId: string,
    decision: 'accepted' | 'rejected',
  ) => {
    try {
      await overrideAdminSubmission(
        submissionId,
        decision,
        `Admin override: ${decision}`,
      );
      setInspectSub(null);
      loadAll();
      Alert.alert('Updated', `Submission marked as ${decision}.`);
    } catch (err: any) {
      Alert.alert('Override Failed', err?.message || 'Error updating status.');
    }
  };

  const handleMarkPaid = async (paymentId: string) => {
    try {
      await markAdminPaymentPaid(paymentId);
      loadAll();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not mark payment paid.');
    }
  };

  const pendingReviewCount =
    (stats?.pending_moderator ??
      stats?.submissions_by_status?.ai_reviewed ??
      0) +
    (stats?.pending_doctor ??
      stats?.submissions_by_status?.moderator_approved ??
      0);

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
              loadAll();
            }}
            tintColor="#FFFFFF"
          />
        }>
        <View style={styles.topBar}>
          <View style={{flex: 1}}>
            <Text style={styles.kicker}>GOVERNANCE PORTAL</Text>
            <Text style={styles.title}>Admin Dashboard</Text>
            {user?.fullName ? (
              <Text style={styles.subName}>{user.fullName}</Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Users</Text>
            <Text style={styles.kpiVal}>{stats?.total_users ?? users.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Submissions Today</Text>
            <Text style={styles.kpiVal}>
              {stats?.today_submissions ??
                stats?.submissions_today ??
                stats?.total_submissions ??
                submissions.length}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pending Review</Text>
            <Text style={[styles.kpiVal, {color: V4_COLORS.warning}]}>
              {pendingReviewCount}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Paid Out</Text>
            <Text style={[styles.kpiVal, {color: V4_COLORS.success}]}>
              ₹
              {Number(
                stats?.total_payouts ?? stats?.total_payments_amount ?? 0,
              ).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Section Navigation */}
        <View style={styles.tabsRow}>
          {(
            [
              {key: 'overview', label: 'Overview'},
              {key: 'users', label: 'Users'},
              {key: 'submissions', label: 'Submissions'},
              {key: 'payments', label: 'Payments'},
            ] as const
          ).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}>
              <Text
                style={[
                  styles.tabText,
                  tab === t.key && styles.tabTextActive,
                ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(tab === 'users' || tab === 'submissions') && (
          <View style={styles.filterBox}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search name, ID, email, phone..."
              placeholderTextColor="rgba(148,163,184,0.75)"
              style={styles.searchInput}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{marginTop: 8}}>
              {['', 'doctor', 'field_worker', 'moderator', 'admin'].map(r => (
                <TouchableOpacity
                  key={r || 'all'}
                  style={[
                    styles.filterChip,
                    roleFilter === r && styles.filterChipActive,
                  ]}
                  onPress={() => setRoleFilter(r)}>
                  <Text style={styles.filterChipText}>
                    {r ? r.replace('_', ' ') : 'All Roles'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#8B5CF6" style={{marginTop: 24}} />
        ) : null}

        {tab === 'overview' && (
          <>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {submissions.slice(0, 8).map(sub => {
              const badge = statusBadgeInfo(sub.status);
              return (
                <TouchableOpacity
                  key={sub.submission_id}
                  style={styles.rowCard}
                  onPress={() => openInspect(sub)}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle}>
                      {sub.patient_name || 'Patient'} · {sub.patient_id}
                    </Text>
                    <View style={[styles.badge, {backgroundColor: badge.bg}]}>
                      <Text style={[styles.badgeText, {color: badge.color}]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowSub}>
                    Role: {sub.submitter_role} · {formatShortDate(sub.created_at)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {tab === 'users' &&
          users.map(u => {
            const active =
              u.status ? u.status === 'active' : u.is_active !== false;
            return (
              <View key={u.user_id} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <View style={{flex: 1}}>
                    <Text style={styles.rowTitle}>
                      {u.full_name || u.username || u.email || 'User'}
                    </Text>
                    <Text style={styles.rowSub}>
                      {u.role}
                      {u.worker_type ? ` (${u.worker_type})` : ''} ·{' '}
                      {u.worker_id || u.email || u.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.statusToggle,
                      {
                        backgroundColor: active
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                      },
                    ]}
                    onPress={() => toggleUserStatus(u)}>
                    <Text
                      style={{
                        color: active ? '#86EFAC' : '#FCA5A5',
                        fontWeight: '800',
                        fontSize: 11,
                      }}>
                      {active ? 'Active · Suspend' : 'Suspended · Activate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

        {tab === 'submissions' && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{marginBottom: 10}}>
              {[
                '',
                'ai_reviewed',
                'moderator_approved',
                'accepted',
                'rejected',
                'moderator_rejected',
              ].map(st => (
                <TouchableOpacity
                  key={st || 'all_st'}
                  style={[
                    styles.filterChip,
                    statusFilter === st && styles.filterChipActive,
                  ]}
                  onPress={() => setStatusFilter(st)}>
                  <Text style={styles.filterChipText}>
                    {st ? st.replace('_', ' ') : 'All Statuses'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {submissions.map(sub => {
              const badge = statusBadgeInfo(sub.status);
              return (
                <TouchableOpacity
                  key={sub.submission_id}
                  style={styles.rowCard}
                  onPress={() => openInspect(sub)}>
                  <View style={styles.rowTop}>
                    <View style={{flex: 1}}>
                      <Text style={styles.rowTitle}>
                        {sub.patient_name || 'Patient'} · {sub.patient_id}
                      </Text>
                      <Text style={styles.rowSub}>
                        By {sub.submitted_by_name || sub.submitter_role} ·{' '}
                        {formatShortDate(sub.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.badge, {backgroundColor: badge.bg}]}>
                      <Text style={[styles.badgeText, {color: badge.color}]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {tab === 'payments' &&
          payments.map(p => (
            <View key={p.payment_id} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <View style={{flex: 1}}>
                  <Text style={styles.rowTitle}>
                    ₹{Number(p.amount).toFixed(0)} · {p.role}
                  </Text>
                  <Text style={styles.rowSub}>
                    {p.user_name || p.user_id} · {p.description || p.submission_id}
                  </Text>
                </View>
                {p.status === 'paid' ? (
                  <View
                    style={[
                      styles.badge,
                      {backgroundColor: 'rgba(34, 197, 94, 0.2)'},
                    ]}>
                    <Text style={[styles.badgeText, {color: '#86EFAC'}]}>
                      Paid ✓
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.badge,
                      {backgroundColor: 'rgba(37, 99, 235, 0.28)'},
                    ]}
                    onPress={() => handleMarkPaid(p.payment_id)}>
                    <Text style={[styles.badgeText, {color: '#93C5FD'}]}>
                      Mark Paid
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
      </ScrollView>

      {/* Submission Inspector & Override Modal */}
      <Modal
        visible={Boolean(inspectSub)}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectSub(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {inspectSub?.patient_name || 'Patient'} ·{' '}
                {inspectSub?.patient_id}
              </Text>
              <Text style={styles.rowSub}>
                Status: {inspectSub?.status} · Submitter:{' '}
                {inspectSub?.submitter_role}
              </Text>
              <Text style={[styles.rowSub, {marginTop: 6}]}>
                Age {inspectSub?.patient_age ?? '—'} · BP{' '}
                {inspectSub?.bp_systolic ?? inspectSub?.patient_bp_systolic ?? '—'}
                /
                {inspectSub?.bp_diastolic ??
                  inspectSub?.patient_bp_diastolic ??
                  '—'}{' '}
                · Sugar{' '}
                {inspectSub?.blood_sugar ??
                  inspectSub?.patient_blood_sugar ??
                  '—'}
              </Text>
              {inspectSub?.diagnosis ? (
                <Text style={[styles.rowTitle, {marginTop: 8}]}>
                  Diagnosis: {inspectSub.diagnosis}
                </Text>
              ) : null}

              {inspectSub?.photos && inspectSub.photos.length > 0 && (
                <View style={styles.modalPhotos}>
                  {inspectSub.photos.map(ph => {
                    const uri = resolvePhotoUri(ph);
                    if (!uri) {
                      return null;
                    }
                    return (
                      <Image
                        key={ph.photo_id}
                        source={{uri}}
                        style={styles.modalPhotoImg}
                        resizeMode="cover"
                      />
                    );
                  })}
                </View>
              )}

              <View style={styles.overrideRow}>
                <TouchableOpacity
                  style={[
                    styles.overrideBtn,
                    {backgroundColor: V4_COLORS.success},
                  ]}
                  onPress={() =>
                    inspectSub &&
                    handleOverride(inspectSub.submission_id, 'accepted')
                  }>
                  <Text style={styles.overrideText}>Force Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.overrideBtn,
                    {backgroundColor: V4_COLORS.danger},
                  ]}
                  onPress={() =>
                    inspectSub &&
                    handleOverride(inspectSub.submission_id, 'rejected')
                  }>
                  <Text style={styles.overrideText}>Force Reject</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setInspectSub(null)}>
                <Text style={styles.overrideText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
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
    color: '#A78BFA',
    letterSpacing: 1,
  },
  title: {fontSize: 23, fontWeight: '900', color: V4_COLORS.text, marginTop: 2},
  subName: {fontSize: 12, color: V4_COLORS.mutedText, marginTop: 2},
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: {color: '#FCA5A5', fontWeight: '800', fontSize: 12},
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  kpiCard: {
    width: '48.8%',
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 13,
    marginBottom: 10,
  },
  kpiLabel: {fontSize: 11, color: V4_COLORS.mutedText, fontWeight: '700'},
  kpiVal: {
    fontSize: 24,
    fontWeight: '900',
    color: V4_COLORS.text,
    marginTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: V4_COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  tabBtn: {flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9},
  tabBtnActive: {backgroundColor: V4_COLORS.primary},
  tabText: {color: V4_COLORS.mutedText, fontWeight: '800', fontSize: 12},
  tabTextActive: {color: '#FFFFFF'},
  filterBox: {marginBottom: 12},
  searchInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: V4_COLORS.text,
    fontSize: 13,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: V4_COLORS.card,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
    borderColor: V4_COLORS.primary,
  },
  filterChipText: {
    color: V4_COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: V4_COLORS.text,
    marginBottom: 10,
  },
  rowCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 13,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: {color: V4_COLORS.text, fontWeight: '800', fontSize: 14},
  rowSub: {color: V4_COLORS.mutedText, fontSize: 12, marginTop: 3},
  badge: {paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8},
  badgeText: {fontSize: 11, fontWeight: '800'},
  statusToggle: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    maxHeight: '85%',
    backgroundColor: V4_COLORS.cardSolid,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  modalTitle: {color: V4_COLORS.text, fontWeight: '900', fontSize: 18},
  modalPhotos: {flexDirection: 'row', gap: 8, marginTop: 12},
  modalPhotoImg: {flex: 1, height: 95, borderRadius: 10},
  overrideRow: {flexDirection: 'row', gap: 10, marginTop: 16},
  overrideBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  overrideText: {color: '#FFFFFF', fontWeight: '900', fontSize: 13},
  closeBtn: {
    marginTop: 10,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
