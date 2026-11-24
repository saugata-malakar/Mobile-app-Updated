import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {AppRole, SubmissionRecord} from '../../types/app';
import {getHomeRouteForRole} from '../../services/authService';
import {V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'SubmissionResult'>;
};

export default function SubmissionResultScreen({navigation, route}: Props) {
  const params = (route.params || {}) as {
    role?: AppRole;
    submission?: SubmissionRecord;
  };
  const role: AppRole = params.role || 'field_worker';
  const sub = params.submission;

  const isRejected =
    sub?.status === 'rejected' ||
    sub?.ai_quality_passed === false ||
    sub?.ai_quality_passed === 0;

  let headline = '';
  let detail = '';
  let icon = '✅';
  let accent = V4_COLORS.success;

  if (isRejected) {
    icon = '❌';
    accent = V4_COLORS.danger;
    headline = '❌ Submission Rejected — Blurry or incomplete photos. No payment.';
    detail =
      sub?.ai_rejection_reason ||
      'One or more photos did not pass the AI quality check. Please retake with good lighting and a reference coin.';
  } else if (role === 'doctor') {
    headline = '✅ Submission Accepted — ₹80 credited to your account';
    detail =
      'AI quality check passed. ₹80 has been credited to your doctor account (plus ₹20 helper share). Follow-up is recommended in 1 month using the same Patient ID.';
  } else {
    headline = '✅ Submission Received — Under moderator review';
    detail =
      'AI quality check passed! Your record is now in the Moderator queue. After moderator approval and doctor clinical note, ₹50 will be credited to your account.';
  }

  const goHome = () => {
    const homeRoute = getHomeRouteForRole(role);
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: homeRoute}]}),
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <View style={styles.container}>
        <View style={[styles.iconCircle, {borderColor: accent}]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.detail}>{detail}</Text>

        {sub?.patient_id ? (
          <View style={styles.idBox}>
            <Text style={styles.idLabel}>Patient ID (save for 1-month follow-up)</Text>
            <Text style={styles.idVal}>{sub.patient_id}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.homeBtn} onPress={goHome}>
          <Text style={styles.homeBtnText}>Return to Home Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: V4_COLORS.bg},
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    backgroundColor: V4_COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {fontSize: 40},
  headline: {
    fontSize: 20,
    fontWeight: '900',
    color: V4_COLORS.text,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 12,
  },
  detail: {
    fontSize: 14,
    color: V4_COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  idBox: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  idLabel: {fontSize: 11, color: V4_COLORS.mutedText, fontWeight: '700'},
  idVal: {
    fontSize: 17,
    color: '#93C5FD',
    fontWeight: '900',
    marginTop: 4,
  },
  homeBtn: {
    backgroundColor: V4_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  homeBtnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
});
