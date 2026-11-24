import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppRole} from '../types/app';
import {V4_COLORS} from '../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const ROLES: Array<{
  role: AppRole;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  accent: string;
}> = [
  {
    role: 'doctor',
    icon: '👨‍⚕️',
    title: 'Doctor',
    subtitle:
      'Collect 3-photo wound records with clinical notes (₹80) & validate ASHA records (₹30).',
    badge: 'Clinical Lead',
    accent: '#2563EB',
  },
  {
    role: 'field_worker',
    icon: '🏥',
    title: 'ASHA / ICDS / CHO (Field Worker)',
    subtitle:
      'Register patients & capture 3 guided photos in the field — no diagnosis required (₹50).',
    badge: 'Field Collector',
    accent: '#22C55E',
  },
  {
    role: 'moderator',
    icon: '🔍',
    title: 'Moderator',
    subtitle:
      'Review field worker submissions & 3 photos for quality before doctor validation (₹20).',
    badge: 'Quality Review',
    accent: '#F59E0B',
  },
  {
    role: 'admin',
    icon: '⚙️',
    title: 'Admin',
    subtitle:
      'Monitor daily stats, approve or suspend users, inspect submissions, and manage ₹ payouts.',
    badge: 'Governance',
    accent: '#8B5CF6',
  },
];

export default function RoleSelectScreen({navigation}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>DIABETESCARE AI · v4.0</Text>
        <Text style={styles.title}>Select Your Role</Text>
        <Text style={styles.sub}>
          Choose your portal to sign in or register with your ID, phone, email, or username.
        </Text>

        {ROLES.map(item => (
          <TouchableOpacity
            key={item.role}
            activeOpacity={0.88}
            style={[styles.card, {borderColor: `${item.accent}66`}]}
            onPress={() => navigation.navigate('Login', {role: item.role})}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, {backgroundColor: `${item.accent}22`}]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.badge, {backgroundColor: `${item.accent}22`}]}>
                  <Text style={[styles.badgeText, {color: item.accent}]}>{item.badge}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.cardHint}>{item.subtitle}</Text>
            <Text style={[styles.ctaText, {color: item.accent}]}>Continue →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: V4_COLORS.bg},
  container: {padding: 20, paddingBottom: 40},
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: V4_COLORS.text,
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: V4_COLORS.mutedText,
    marginBottom: 20,
    lineHeight: 20,
  },
  card: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {fontSize: 24},
  cardTitleWrap: {flex: 1},
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: V4_COLORS.text,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardHint: {
    marginTop: 10,
    fontSize: 13,
    color: V4_COLORS.mutedText,
    lineHeight: 19,
  },
  ctaText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
});
