import React, {useCallback, useRef, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import SignatureCanvas from 'react-native-signature-canvas';
import type {SignatureViewRef} from 'react-native-signature-canvas';

import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {api} from '../services/apiClient';
import {enqueueRequest} from '../services/offlineQueue';
import {getSession} from '../storage/appStorage';
import {markPatientOnboardingComplete, setPatientOnboarding} from '../storage/onboardingStorage';
import {fingerprintConsentSignature} from '../utils/consentHash';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Consent'>;
type Rt = RouteProp<RootStackParamList, 'Consent'>;

const CONSENT_VERSION = '1.0';

async function syncConsentToServer(body: Record<string, unknown>): Promise<void> {
  try {
    const net = await NetInfo.fetch();
    if (net.isConnected) {
      await api.post('/api/v1/patients/me/consent', body);
      return;
    }
  } catch {
    // fall through to queue
  }
  try {
    await enqueueRequest('POST', '/api/v1/patients/me/consent', body);
  } catch {
    // local onboarding already saved; server sync can retry later from queue UI
  }
}

export default function ConsentScreen({navigation, route}: {navigation: Nav; route: Rt}) {
  const onboarding = route.params?.onboarding === true;
  const ref = useRef<SignatureViewRef>(null);
  const [busy, setBusy] = useState(false);
  const leftScreen = useRef(false);

  const submitHash = useCallback(
    async (signaturePngBase64: string) => {
      if (busy || leftScreen.current) {
        return;
      }
      if (!signaturePngBase64 || typeof signaturePngBase64 !== 'string' || signaturePngBase64.length < 20) {
        Alert.alert(
          'Signature required',
          'Please sign in the box above, then tap Confirm & continue.',
        );
        return;
      }

      setBusy(true);
      try {
        const body = {
          consent_version: CONSENT_VERSION,
          consent_type: 'STAGE1_RESEARCH',
          signed_by_method: 'DIGITAL_SIGNATURE',
          modules_consented: ['WOUND'],
          digital_signature_hash: fingerprintConsentSignature(signaturePngBase64),
        };

        const session = await getSession();
        if (session?.role === 'patient' && session.phone) {
          await setPatientOnboarding(session.phone, {consentDone: true});
          if (onboarding) {
            await markPatientOnboardingComplete(session.phone);
          }
        }

        leftScreen.current = true;
        if (onboarding) {
          navigation.reset({
            index: 0,
            routes: [{name: 'PatientHome'}],
          });
        } else {
          navigation.goBack();
        }

        void syncConsentToServer(body).catch(() => {
          /* non-blocking; consent is already stored locally */
        });

        if (!onboarding) {
          Alert.alert('Thank you', 'Consent recorded on this device.');
        }
      } catch (err) {
        console.warn('Consent submit failed', err);
        Alert.alert(
          'Could not save',
          'Something went wrong saving your consent. Please try again.',
        );
      } finally {
        if (!leftScreen.current) {
          setBusy(false);
        }
      }
    },
    [busy, navigation, onboarding],
  );

  const onOK = useCallback(
    (sig: string) => {
      submitHash(sig).catch(err => {
        console.warn('Consent onOK', err);
        Alert.alert('Error', 'Could not process signature. Please try again.');
        setBusy(false);
        leftScreen.current = false;
      });
    },
    [submitHash],
  );

  const onEmpty = useCallback(() => {
    Alert.alert('Signature required', 'Please sign in the box above, then tap Confirm & continue.');
  }, []);

  const onPadError = useCallback((error: unknown) => {
    console.warn('Signature pad error', error);
    Alert.alert('Signature pad', 'The signature area had a problem. Tap Clear pad and sign again.');
    setBusy(false);
  }, []);

  const confirmSignature = useCallback(() => {
    if (busy) {
      return;
    }
    ref.current?.readSignature();
  }, [busy]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Research consent</Text>
        <Text style={styles.body}>
          Version {CONSENT_VERSION}. Stage 1 covers wound photography for screening and
          study participation. Sign below to confirm you understand the information sheet.
        </Text>

        <View style={styles.padWrap}>
          <SignatureCanvas
            ref={ref}
            onOK={onOK}
            onEmpty={onEmpty}
            onError={onPadError}
            descriptionText="Sign here"
            clearText="Clear"
            confirmText="Save"
            webStyle={`.m-signature-pad--footer {display: none; margin: 0px;} .m-signature-pad {box-shadow: none; border: none; }`}
            backgroundColor="rgba(15,23,42,0.95)"
            penColor="#F8FAFC"
            style={styles.pad}
          />
        </View>

        <TouchableOpacity
          style={[styles.primary, busy && styles.disabled]}
          disabled={busy}
          onPress={confirmSignature}>
          <Text style={styles.primaryText}>
            {busy ? 'Saving…' : onboarding ? 'Confirm & continue' : 'Confirm signature'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outline, busy && styles.disabled]}
          disabled={busy}
          onPress={() => ref.current?.clearSignature()}>
          <Text style={styles.outlineText}>Clear pad</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          disabled={busy}
          onPress={() => {
            if (onboarding) {
              navigation.reset({index: 0, routes: [{name: 'PatientHome'}]});
            } else {
              navigation.goBack();
            }
          }}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 16, paddingBottom: 32},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  body: {
    marginTop: 10,
    fontSize: 14,
    color: 'rgba(248,250,252,0.78)',
    lineHeight: 20,
    marginBottom: 12,
  },
  padWrap: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    marginTop: 8,
  },
  pad: {flex: 1},
  primary: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  outline: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    alignItems: 'center',
  },
  disabled: {opacity: 0.55},
  outlineText: {color: '#F8FAFC', fontWeight: '800'},
  link: {marginTop: 16, alignItems: 'center'},
  linkText: {color: '#93C5FD', fontWeight: '800'},
});
