import React, {useCallback, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {logoutToRoleSelect} from '../navigation/navigationUtils';
import {getPatientSelfProfile, getSession} from '../storage/appStorage';
import type {PatientProfile} from '../types/app';
import NetworkStatus from '../components/NetworkStatus';
import {SCREENING_DISCLAIMER} from '../utils/openTelemedicine';
import {getPatientDashboard} from '../storage/patientDashboardStorage';
import type {
  PatientAlert,
  PatientDashboardSnapshot,
  ScheduledTask,
  WoundSiteRecord,
} from '../types/patientDashboard';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PatientHome'>;

function fmtDate(iso: string | null | undefined) {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function WoundDot({dot}: {dot: WoundSiteRecord['lastDot']}) {
  const c =
    dot === 'green' ? '#22C55E' : dot === 'amber' ? '#F59E0B' : '#EF4444';
  return <View style={[styles.dot, {backgroundColor: c}]} />;
}

export default function PatientHome({navigation}: {navigation: Nav}) {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [name, setName] = useState('');
  const [dash, setDash] = useState<PatientDashboardSnapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const s = await getSession();
        if (!alive || !s || s.role !== 'patient') {
          void logoutToRoleSelect(navigation);
          return;
        }
        const p = await getPatientSelfProfile(s.phone);
        const d = await getPatientDashboard();
        if (!alive) {
          return;
        }
        setProfile(p);
        setName(p?.fullName ?? s.displayName);
        setDash(d);
      })();
      return () => {
        alive = false;
      };
    }, [navigation]),
  );

  const startScreening = (followUp: boolean) => {
    if (!profile) {
      navigation.navigate('PatientRegistration', {flow: 'first_time'});
      return;
    }
    navigation.navigate('LanguageSelect', {
      language: undefined,
      screeningContext: {
        sessionRole: 'patient',
        patientId: profile.id,
        patientName: profile.fullName,
        followUp,
      },
    });
  };

  const signOut = async () => {
    await logoutToRoleSelect(navigation);
  };

  const onTaskDoNow = (t: ScheduledTask) => {
    const woundish = /wound/i.test(t.moduleName);
    if (woundish && t.wound_site_id && t.woundSiteLabel) {
      navigation.navigate('WoundSessionGuide', {
        wound_site_id: t.wound_site_id,
        wound_site_label: t.woundSiteLabel,
        language: 'en',
      });
      return;
    }
    if (/skin/i.test(t.moduleName)) {
      navigation.navigate('SkinSessionGuide', {language: 'en'});
      return;
    }
    navigation.navigate('SkinMonitorHome');
  };

  const subscribed =
    dash?.subscription.status === 'ACTIVE' || dash?.subscription.status === 'TRIAL';

  const requireSubscription = (next: () => void) => {
    if (subscribed) {
      next();
    } else {
      navigation.navigate('SubscriptionManager');
    }
  };

  const openAlert = (a: PatientAlert) => {
    navigation.navigate('WoundResult', {
      session_id: `alert_${a.id}`,
      wound_site_id: 'ws_demo_1',
      wound_site_label: 'Tracked site',
      alert_level: a.level === 'red' ? 'red' : 'amber',
      language: 'en',
    });
  };

  const activeWounds = dash?.woundSites.filter(w => w.active) ?? [];
  const alerts = (dash?.alerts ?? []).filter(a => !a.resolved && (a.level === 'amber' || a.level === 'red'));
  const sub = dash?.subscription;

  return (
    <SafeAreaView style={styles.safe}>
      <NetworkStatus />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={{flex: 1}}>
            <Text style={styles.welcome}>Hello{name ? `, ${name}` : ''}</Text>
            <Text style={styles.role}>Patient home</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.outBtn}>
            <Text style={styles.outBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {profile && (
          <View style={styles.row2}>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => navigation.navigate('PatientProfile', {initialTab: 'medical'})}>
              <Text style={styles.smallBtnText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => navigation.navigate('MedicalHistorySetup', {})}>
              <Text style={styles.smallBtnText}>Medical history</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => navigation.navigate('Consent', {})}>
              <Text style={styles.smallBtnText}>Consent</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.hubRow}>
          <TouchableOpacity
            style={styles.hubCard}
            onPress={() =>
              requireSubscription(() => {
                const sites = dash?.woundSites.filter(w => w.active) ?? [];
                if (sites.length > 0) {
                  navigation.navigate('WoundMonitorHome', {
                    wound_site_id: sites[0].id,
                    wound_site_label: sites[0].label,
                  });
                } else {
                  navigation.navigate('WoundSiteSelector');
                }
              })
            }>
            <Text style={styles.hubTitle}>Wound monitor</Text>
            <Text style={styles.hubHint}>Weekly photos · P8–P16</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hubCard}
            onPress={() => requireSubscription(() => navigation.navigate('SkinMonitorHome'))}>
            <Text style={styles.hubTitle}>Skin check</Text>
            <Text style={styles.hubHint}>Monthly · P17–P19</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.hubCard}
            onPress={() => requireSubscription(() => navigation.navigate('ContributingFactorHome'))}>
            <Text style={styles.hubTitle}>Blood & eye</Text>
            <Text style={styles.hubHint}>Quarterly · P20–P23</Text>
          </TouchableOpacity>
        </View>

        {/* 1. Subscription */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscription</Text>
          {sub?.status === 'NONE' && (
            <>
              <Text style={styles.cardLineMuted}>You are not subscribed yet.</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('SubscriptionManager')}>
                <Text style={styles.primaryBtnText}>Start free trial</Text>
              </TouchableOpacity>
            </>
          )}
          {sub?.status === 'TRIAL' && (
            <Text style={styles.cardLineMuted}>
              Free trial: {sub.trialDaysRemaining ?? 0} days remaining. Subscribe to continue.
            </Text>
          )}
          {sub?.status === 'ACTIVE' && (
            <>
              <Text style={styles.cardLine}>
                Plan: {sub.tier ?? '—'} · Next billing: {fmtDate(sub.nextBillingDate)}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SubscriptionManager')}>
                <Text style={styles.editLinkText}>Manage</Text>
              </TouchableOpacity>
            </>
          )}
          {sub?.status === 'SUSPENDED' && (
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>Monitoring paused — payment needed</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SubscriptionManager')}>
                <Text style={styles.editLinkText}>Update billing</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 2. My wounds */}
        {activeWounds.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>My wounds</Text>
            {activeWounds.map(w => (
              <View key={w.id} style={styles.woundCard}>
                <View style={styles.woundRow}>
                  <Text style={styles.cardLine}>
                    {(w.side === 'L' ? 'Left' : 'Right')} · {w.label}
                  </Text>
                  <WoundDot dot={w.lastDot} />
                </View>
                <Text style={styles.cardLineMuted}>
                  Last session: {fmtDate(w.lastSessionDate)} · AI: {w.lastDot.toUpperCase()}
                </Text>
                {w.sessionDueToday || w.overdueDays > 0 ? (
                  <TouchableOpacity
                    style={[
                      styles.photoDueBtn,
                      w.overdueDays > 0 && styles.photoDueBtnOverdue,
                    ]}
                    onPress={() =>
                      navigation.navigate('WoundSessionGuide', {
                        wound_site_id: w.id,
                        wound_site_label: w.label,
                        language: 'en',
                      })
                    }>
                    <Text style={styles.photoDueBtnText}>
                      {w.overdueDays > 0
                        ? `Photograph today (overdue ${w.overdueDays}d)`
                        : 'Photograph today'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('WoundMonitorHome', {
                      wound_site_id: w.id,
                      wound_site_label: w.label,
                    })
                  }>
                  <Text style={styles.inlineLink}>View history</Text>
                </TouchableOpacity>
              </View>
            ))}
            {activeWounds.length < 5 ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('WoundSiteSelector')}>
                <Text style={styles.secondaryBtnText}>Add new wound site</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* 3. Today’s tasks */}
        {dash && dash.tasks.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today's tasks</Text>
            {dash.tasks.map(t => (
              <View key={t.id} style={styles.taskRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.cardLine}>{t.moduleName}</Text>
                  {t.woundSiteLabel ? (
                    <Text style={styles.cardLineMuted}>{t.woundSiteLabel}</Text>
                  ) : null}
                  <Text
                    style={[
                      styles.dueLbl,
                      t.urgent || t.overdue ? styles.dueUrgent : undefined,
                    ]}>
                    Due: {fmtDate(t.dueDate)}
                    {t.overdue ? ' · Overdue' : ''}
                  </Text>
                </View>
                <TouchableOpacity style={styles.taskGo} onPress={() => onTaskDoNow(t)}>
                  <Text style={styles.taskGoText}>Do now</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {/* 4. Recent alerts */}
        {alerts.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent alerts</Text>
            {alerts.slice(0, 3).map(a => (
              <TouchableOpacity key={a.id} style={styles.alertRow} onPress={() => openAlert(a)}>
                <View
                  style={[
                    styles.alertDot,
                    {backgroundColor: a.level === 'red' ? '#EF4444' : '#F59E0B'},
                  ]}
                />
                <View style={{flex: 1}}>
                  <Text style={styles.cardLine}>{a.title}</Text>
                  <Text style={styles.cardLineMuted} numberOfLines={2}>
                    {a.summary}
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* 5. Teleconsult */}
        {dash?.teleconsult ? (
          <View style={styles.teleCard}>
            <Text style={styles.teleTitle}>Upcoming teleconsult</Text>
            <Text style={styles.cardLine}>{dash.teleconsult.doctorName}</Text>
            <Text style={styles.teleBody}>{fmtDateTime(dash.teleconsult.scheduledIso)}</Text>
            <Text style={styles.teleBody}>Call from: {dash.teleconsult.callingNumber}</Text>
            {dash.teleconsult.teleconsultId ? (
              <TouchableOpacity
                style={styles.teleBtnSecondary}
                onPress={() =>
                  navigation.navigate('QueueStatus', {
                    teleconsultId: dash.teleconsult!.teleconsultId!,
                    language: 'en',
                  })
                }>
                <Text style={styles.teleBtnSecondaryText}>View or cancel</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.teleCard}>
            <Text style={styles.teleTitle}>Teleconsult</Text>
            <Text style={styles.teleBody}>No booking yet. Book a clinician callback when you need help.</Text>
            <TouchableOpacity
              style={styles.teleBtn}
              onPress={() => navigation.navigate('ConsultRequest', {language: 'en'})}>
              <Text style={styles.teleBtnText}>Book teleconsult</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 6. Quick links */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick links</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('PatientProfile', {initialTab: 'rx'})}>
            <Text style={styles.linkRowText}>My prescriptions</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('ConsultRequest', {language: 'en'})}>
            <Text style={styles.linkRowText}>Book teleconsult</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() =>
              navigation.navigate('ProgressReport', {
                wound_site_id: activeWounds[0]?.id,
              })
            }>
            <Text style={styles.linkRowText}>My progress report</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('LanguageSelect', {language: 'en'})}>
            <Text style={styles.linkRowText}>Language (S1)</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('NotificationSettings')}>
            <Text style={styles.linkRowText}>Notification settings</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('SkinMonitorHome')}>
            <Text style={styles.linkRowText}>Skin monitoring</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('ContributingFactorHome')}>
            <Text style={styles.linkRowText}>Contributing factors</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('DataPrivacySettings')}>
            <Text style={styles.linkRowText}>Data & privacy</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        </View>

        {profile && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your registration</Text>
            <Text style={styles.cardLine}>
              {profile.fullName} · {profile.age} yrs · {profile.phone}
            </Text>
            <Text style={styles.cardLineMuted} numberOfLines={2}>
              {profile.address}
              {profile.village ? ` · ${profile.village}` : ''}
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('PatientRegistration', {flow: 'patient_edit'})}
              style={styles.editLink}>
              <Text style={styles.editLinkText}>Edit profile</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.primaryBtn}
          onPress={() => startScreening(false)}>
          <Text style={styles.primaryBtnText}>New screening</Text>
          <Text style={styles.primaryHint}>First visit or new complaint</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.secondaryBtn}
          onPress={() => startScreening(true)}
          disabled={!profile}>
          <Text style={styles.secondaryBtnText}>Follow-up visit</Text>
          <Text style={styles.secondaryHint}>
            Same patient — details stay on file (no re-registration).
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>{SCREENING_DISCLAIMER}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 28},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  welcome: {fontSize: 24, fontWeight: '900', color: '#F8FAFC'},
  role: {marginTop: 6, color: 'rgba(248,250,252,0.72)'},
  outBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  outBtnText: {color: '#F8FAFC', fontWeight: '800', fontSize: 13},
  card: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    marginBottom: 16,
  },
  cardTitle: {color: '#F8FAFC', fontWeight: '900', marginBottom: 8, fontSize: 16},
  cardLine: {color: 'rgba(248,250,252,0.92)', fontWeight: '700'},
  cardLineMuted: {marginTop: 6, color: 'rgba(248,250,252,0.65)', fontSize: 13, lineHeight: 18},
  editLink: {marginTop: 10, alignSelf: 'flex-start'},
  editLinkText: {color: '#93C5FD', fontWeight: '900', fontSize: 14},
  warnBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
  },
  warnTitle: {color: '#FEF9C3', fontWeight: '900'},
  sectionBlock: {marginBottom: 16},
  sectionTitle: {color: '#F8FAFC', fontWeight: '900', fontSize: 17, marginBottom: 10},
  woundCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    marginBottom: 10,
  },
  woundRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  dot: {width: 12, height: 12, borderRadius: 99},
  photoDueBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  photoDueBtnOverdue: {backgroundColor: '#B45309'},
  photoDueBtnText: {color: '#F8FAFC', fontWeight: '900'},
  inlineLink: {marginTop: 10, color: '#93C5FD', fontWeight: '800'},
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  dueLbl: {marginTop: 4, fontSize: 12, color: 'rgba(148,163,184,0.95)'},
  dueUrgent: {color: '#FBBF24', fontWeight: '800'},
  taskGo: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.5)',
  },
  taskGoText: {color: '#E0F2FE', fontWeight: '900', fontSize: 13},
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  alertDot: {width: 10, height: 10, borderRadius: 99},
  chev: {color: '#94A3B8', fontSize: 20, fontWeight: '700'},
  primaryBtn: {
    borderRadius: 16,
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  primaryBtnText: {color: '#F8FAFC', fontWeight: '900', fontSize: 17},
  primaryHint: {marginTop: 6, color: 'rgba(248,250,252,0.75)', fontSize: 13},
  secondaryBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.45)',
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {color: '#F8FAFC', fontWeight: '900', fontSize: 17},
  secondaryHint: {marginTop: 6, color: 'rgba(248,250,252,0.72)', fontSize: 13},
  teleCard: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.35)',
  },
  teleTitle: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  teleBody: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(248,250,252,0.78)',
    lineHeight: 19,
  },
  teleBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#6366F1',
  },
  teleBtnText: {color: '#F8FAFC', fontWeight: '900', fontSize: 15},
  teleBtnSecondary: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.25)',
  },
  teleBtnSecondaryText: {color: '#E0E7FF', fontWeight: '800'},
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  linkRowText: {color: '#E2E8F0', fontWeight: '800', fontSize: 15},
  disclaimer: {
    marginTop: 20,
    fontSize: 12,
    color: 'rgba(148,163,184,0.95)',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  row2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  smallBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
  },
  smallBtnText: {color: '#E2E8F0', fontWeight: '900', fontSize: 13},
  hubRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
  hubCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  hubTitle: {color: '#F8FAFC', fontWeight: '900', fontSize: 13},
  hubHint: {marginTop: 6, color: 'rgba(248,250,252,0.65)', fontSize: 11, lineHeight: 15},
});
