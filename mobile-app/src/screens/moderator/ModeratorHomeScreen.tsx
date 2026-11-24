import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {CommonActions, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {SubmissionRecord, UserProfile} from '../../types/app';
import {getAuthSession, logoutV4} from '../../services/authService';
import {
  getModeratorQueue,
  getMyPayments,
} from '../../services/v4WorkflowService';
import {formatShortDate, statusBadgeInfo, V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ModeratorHomeScreen({navigation}: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [queue, setQueue] = useState<SubmissionRecord[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const session = await getAuthSession();
    setUser(session?.user || null);
    try {
      const [items, payData] = await Promise.all([
        getModeratorQueue(tab === 'pending' ? 'ai_reviewed' : 'all').catch(
          () => [],
        ),
        getMyPayments().catch(() => ({
          payments: [],
          total_earned: 0,
          total_pending: 0,
        })),
      ]);
      setQueue(items);
      setReviewCount((payData.payments || []).length);
      setTotalEarned(Number(payData.total_earned || 0));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleLogout = async () => {
    await logoutV4();
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'PortalLogin'}]}),
    );
  };

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
              loadData();
            }}
            tintColor="#FFFFFF"
          />
        }>
        <View style={styles.topBar}>
          <View style={{flex: 1}}>
            <Text style={styles.kicker}>QUALITY REVIEW</Text>
            <Text style={styles.title}>Moderator Dashboard</Text>
            {user?.fullName ? (
              <Text style={styles.subName}>Signed in as {user.fullName}</Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>My Reviews</Text>
            <Text style={styles.statValue}>{reviewCount}</Text>
          </View>
          <View
            style={[
              styles.statCard,
              {borderColor: 'rgba(34, 197, 94, 0.45)'},
            ]}>
            <Text style={[styles.statLabel, {color: '#86EFAC'}]}>Earnings</Text>
            <Text style={styles.statValue}>₹{totalEarned.toFixed(0)}</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, tab === 'pending' && styles.segActive]}
            onPress={() => setTab('pending')}>
            <Text
              style={[
                styles.segText,
                tab === 'pending' && styles.segTextActive,
              ]}>
              Pending Queue
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, tab === 'history' && styles.segActive]}
            onPress={() => setTab('history')}>
            <Text
              style={[
                styles.segText,
                tab === 'history' && styles.segTextActive,
              ]}>
              All Reviewed
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#F59E0B" style={{marginTop: 24}} />
        ) : queue.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {tab === 'pending'
                ? 'No ASHA/ICDS/CHO submissions awaiting moderator review.'
                : 'No reviewed submissions found yet.'}
            </Text>
          </View>
        ) : (
          queue.map(item => {
            const badge = statusBadgeInfo(item.status);
            return (
              <TouchableOpacity
                key={item.submission_id}
                activeOpacity={0.86}
                style={styles.card}
                onPress={() =>
                  navigation.navigate('ModeratorReview', {submission: item})
                }>
                <View style={styles.cardTop}>
                  <View style={{flex: 1}}>
                    <Text style={styles.patientName}>
                      {item.patient_name || 'Patient'} · {item.patient_id}
                    </Text>
                    <Text style={styles.collectorLine}>
                      Collector: {item.submitted_by_name || 'Field Worker'} (
                      {item.worker_type || 'ASHA'})
                    </Text>
                  </View>
                  <View style={[styles.badge, {backgroundColor: badge.bg}]}>
                    <Text style={[styles.badgeText, {color: badge.color}]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.timeText}>
                    {formatShortDate(item.created_at)}
                  </Text>
                  <Text style={styles.reviewCta}>Inspect 3 Photos →</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
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
    color: '#F59E0B',
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
  statsRow: {flexDirection: 'row', gap: 10, marginBottom: 14},
  statCard: {
    flex: 1,
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
  },
  statLabel: {fontSize: 12, color: V4_COLORS.mutedText, fontWeight: '700'},
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: V4_COLORS.text,
    marginTop: 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: V4_COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  segBtn: {flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9},
  segActive: {backgroundColor: V4_COLORS.primary},
  segText: {color: V4_COLORS.mutedText, fontWeight: '800', fontSize: 13},
  segTextActive: {color: '#FFFFFF'},
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  patientName: {color: V4_COLORS.text, fontWeight: '900', fontSize: 15},
  collectorLine: {color: V4_COLORS.mutedText, fontSize: 12, marginTop: 3},
  badge: {paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8},
  badgeText: {fontSize: 11, fontWeight: '800'},
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  timeText: {color: 'rgba(148,163,184,0.85)', fontSize: 11},
  reviewCta: {color: '#FBBF24', fontWeight: '800', fontSize: 12},
});
