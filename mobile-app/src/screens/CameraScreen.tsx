import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import {recordScreeningCompleted} from '../storage/appStorage';
import {encryptPhotoBytes} from '../services/photoCrypto';
import {enqueueRequest} from '../services/offlineQueue';
import type {
  RootStackParamList,
  ScreeningFlowContext,
  WoundCameraFlowParams,
} from '../navigation/RootNavigator';
import QualityValidationOverlay from '../components/QualityValidationOverlay';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function humanAngle(code: string): string {
  switch (code) {
    case 'TOP_DOWN':
      return 'Top-down';
    case 'LEFT_45':
      return 'Left side';
    case 'RIGHT_45':
      return 'Right side';
    default:
      return code;
  }
}

function WoundCameraFlow({
  flow,
  language,
  screeningContext,
}: {
  flow: WoundCameraFlowParams;
  language: 'en' | 'bn' | undefined;
  screeningContext?: ScreeningFlowContext;
}) {
  const navigation = useNavigation<Nav>();
  const angles = flow.angles;
  const [angleIdx, setAngleIdx] = useState(0);
  const [captures, setCaptures] = useState<Array<{angle: string; quality: number} | null>>(() =>
    angles.map(() => null),
  );
  const [stableSince, setStableSince] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setStableSince(Date.now());
  }, [angleIdx]);

  const elapsed = now - stableSince;
  const slotEmpty = captures[angleIdx] == null;
  const checksPass = elapsed > 2000;
  const canCapture = slotEmpty && checksPass;

  const phase = Math.floor(elapsed / 450) % 5;
  const rotateMsg = useMemo(
    () =>
      [
        'Hold steady — image is blurred',
        'Too dark — find better lighting',
        'Move closer to the wound',
        'Place 1 rupee coin next to wound',
        'Use only one coin as reference',
      ][phase],
    [phase],
  );

  const banner = useMemo(() => {
    if (!slotEmpty) {
      return {visible: false, tone: 'bad' as const, message: ''};
    }
    if (checksPass) {
      return {visible: false, tone: 'bad' as const, message: ''};
    }
    return {visible: true, tone: 'bad' as const, message: rotateMsg};
  }, [slotEmpty, checksPass, rotateMsg]);

  const onCapture = () => {
    if (!canCapture) {
      return;
    }
    const quality = 58 + Math.floor(Math.random() * 38);
    const label = humanAngle(angles[angleIdx]);
    const next = [...captures];
    next[angleIdx] = {angle: label, quality};
    setCaptures(next);
    setFlash(true);
    setTimeout(() => setFlash(false), 220);

    const firstEmpty = next.findIndex(c => c == null);
    setAngleIdx(firstEmpty >= 0 ? firstEmpty : angles.length - 1);
  };

  const onPickThumb = (i: number) => {
    if (captures[i]) {
      const next = [...captures];
      next[i] = null;
      setCaptures(next);
      setAngleIdx(i);
    }
  };

  const lang = language === 'bn' ? 'bn' : 'en';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.woundTop}>
        {angles.map((a, i) => (
          <TouchableOpacity
            key={a + i}
            style={[styles.angleTab, i === angleIdx && styles.angleTabOn]}
            onPress={() => setAngleIdx(i)}>
            <Text style={[styles.angleTabT, i === angleIdx && styles.angleTabTOn]}>{humanAngle(a)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.previewBox, flash && styles.previewFlash]}>
        <View style={styles.previewInner}>
          <QualityValidationOverlay
            banner={banner}
            goodBadge={slotEmpty && checksPass}
          />
          <Text style={styles.silhouetteHint}>
            {lang === 'bn'
              ? 'ক্ষত কেন্দ্রে রাখুন (ডেমো গাইড)।'
              : 'Centre the wound — silhouette guide (demo).'}
          </Text>
        </View>
        <Text style={styles.previewHint}>
          {lang === 'bn' ? 'ক্যামেরা প্রিভিউ (ডেমো)' : 'Camera preview (demo)'}
        </Text>
      </View>

      <View style={styles.strip}>
        {angles.map((a, i) => {
          const cap = captures[i];
          return (
            <TouchableOpacity key={`t${i}`} style={styles.thumbSlot} onPress={() => onPickThumb(i)}>
              <View style={[styles.thumbCircle, cap && styles.thumbOk]}>
                <Text style={styles.thumbNum}>{i + 1}</Text>
              </View>
              <Text style={styles.thumbLbl}>{cap ? '✓' : '○'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onCapture}
        disabled={!canCapture}
        style={[styles.captureBtn, !canCapture && styles.captureBtnDisabled]}>
        <Text style={styles.captureText}>
          {lang === 'bn' ? 'ক্যাপচার' : 'Capture'}
        </Text>
      </TouchableOpacity>

      {captures.every(Boolean) ? (
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() =>
            navigation.navigate('PhotoReview', {
              wound_site_id: flow.woundSiteId,
              wound_site_label: flow.woundSiteLabel,
              slots: captures as {angle: string; quality: number}[],
              language: lang,
              screeningContext,
            })
          }>
          <Text style={styles.reviewBtnText}>Review photos</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.goBack()}
        style={styles.backBtn}>
        <Text style={styles.backText}>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export default function CameraScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'CameraScreen'>>();

  const condition: 'skin' | 'eye' | 'wound' | undefined = route.params?.condition;
  const language: 'en' | 'bn' | undefined = route.params?.language;
  const screeningContext = route.params?.screeningContext;
  const woundCameraFlow = route.params?.woundCameraFlow;

  const [analyzing, setAnalyzing] = useState(false);

  const copy = useMemo(() => {
    const title = language === 'bn' ? 'ছবি তুলুন' : 'Take a photo';
    const subtitle =
      language === 'bn'
        ? 'সমস্যার অংশটি স্পষ্টভাবে ফ্রেমে আনুন।'
        : 'Make sure the affected area is clearly in frame.';
    const note =
      language === 'bn'
        ? 'ডেমো মোড: এটি একটি মক স্ক্রিনিং ফলাফল তৈরি করবে।'
        : 'Demo mode: this will generate a mock screening result.';

    const conditionLabel =
      condition === 'eye'
        ? language === 'bn'
          ? 'চোখ'
          : 'Eye'
        : condition === 'wound'
          ? language === 'bn'
            ? 'ক্ষত'
            : 'Wound'
          : condition === 'skin'
            ? language === 'bn'
              ? 'ত্বক'
              : 'Skin'
            : language === 'bn'
              ? 'অজানা'
              : 'Unknown';

    return {title, subtitle, note, conditionLabel};
  }, [condition, language]);

  const runMockAnalysis = async () => {
    if (analyzing) {
      return;
    }
    setAnalyzing(true);

    await new Promise(resolve => setTimeout(resolve, 1100));

    const r = Math.random();
    const riskLevel: 'low' | 'medium' | 'high' =
      r > 0.82 ? 'high' : r > 0.45 ? 'medium' : 'low';

    const conditions =
      condition === 'eye'
        ? ['Conjunctivitis', 'Dry eye', 'Allergic irritation']
        : condition === 'wound'
          ? ['Infection risk', 'Delayed healing', 'Inflammation']
          : ['Dermatitis', 'Fungal infection', 'Allergic rash'];

    const recommendation =
      language === 'bn'
        ? {
            bn:
              riskLevel === 'high'
                ? 'দ্রুত নিকটস্থ চিকিৎসকের সাথে যোগাযোগ করুন। যদি জ্বর/তীব্র ব্যথা/রক্তপাত থাকে, জরুরি সেবা নিন।'
                : riskLevel === 'medium'
                  ? 'পরিষ্কার রাখুন, জ্বালা/ব্যথা বাড়লে চিকিৎসকের পরামর্শ নিন।'
                  : 'পর্যবেক্ষণ করুন। অবস্থা খারাপ হলে চিকিৎসকের সাথে কথা বলুন।',
            en:
              riskLevel === 'high'
                ? 'Contact a clinician urgently. Seek emergency care if there is fever, severe pain, or bleeding.'
                : riskLevel === 'medium'
                  ? 'Keep the area clean. Consult a clinician if symptoms worsen.'
                  : 'Monitor. Talk to a clinician if it gets worse.',
          }
        : {
            bn:
              riskLevel === 'high'
                ? 'দ্রুত নিকটস্থ চিকিৎসকের সাথে যোগাযোগ করুন।'
                : riskLevel === 'medium'
                  ? 'পরিষ্কার রাখুন, বাড়লে চিকিৎসকের পরামর্শ নিন।'
                  : 'পর্যবেক্ষণ করুন।',
            en:
              riskLevel === 'high'
                ? 'Contact a clinician urgently.'
                : riskLevel === 'medium'
                  ? 'Keep the area clean and consult if symptoms worsen.'
                  : 'Monitor.',
          };

    try {
      const patientId = screeningContext?.patientId ?? 'local-patient';
      const deviceId = 'rn-device-local';
      const plain = new Uint8Array(2048);
      if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(plain);
      }
      const enc = encryptPhotoBytes(plain, patientId, deviceId);
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await enqueueRequest(
          'POST',
          '/api/v1/sessions/mock/photographs',
          {
            patientId,
            angle: 'TOP_DOWN',
            encrypted: enc,
          },
          {
            queueKind: 'photograph',
            patientId: screeningContext?.patientId,
            patientName: screeningContext?.patientName,
          },
        );
      }
    } catch {
      // Non-fatal: demo flow continues without upload queue.
    }

    try {
      await recordScreeningCompleted({
        mode: screeningContext?.sessionRole ?? 'patient',
        patientId: screeningContext?.patientId ?? 'local',
        patientName: screeningContext?.patientName ?? 'Patient',
        conditionKey: condition,
        riskLevel,
        ashaWorkerPhone: screeningContext?.ashaWorkerPhone,
        followUp: screeningContext?.followUp ?? false,
      });
    } catch {
      // Still show results even if local bookkeeping fails.
    }

    if (condition === 'skin') {
      navigation.replace('SkinResult');
      setAnalyzing(false);
      return;
    }

    navigation.navigate('ResultScreen', {
      riskLevel,
      conditions,
      recommendation,
      screeningContext,
      language,
    });

    setAnalyzing(false);
  };

  if (woundCameraFlow) {
    return (
      <WoundCameraFlow
        flow={woundCameraFlow}
        language={language}
        screeningContext={screeningContext}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kicker}>
            {language === 'bn' ? 'বিভাগ' : 'Category'}
          </Text>
          <Text style={styles.cardTitle}>{copy.conditionLabel}</Text>
          <Text style={styles.cardSubtitle}>{copy.subtitle}</Text>
          <Text style={styles.cardNote}>{copy.note}</Text>
        </View>

        <View style={styles.previewBox}>
          <View style={styles.previewInner} />
          <Text style={styles.previewHint}>
            {language === 'bn'
              ? 'ক্যামেরা প্রিভিউ (ডেমো)'
              : 'Camera preview (demo)'}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={runMockAnalysis}
          disabled={analyzing}
          style={[styles.captureBtn, analyzing && styles.captureBtnDisabled]}>
          {analyzing ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator color="#F8FAFC" />
              <Text style={styles.captureText}>
                {language === 'bn' ? 'বিশ্লেষণ হচ্ছে…' : 'Analyzing…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.captureText}>
              {language === 'bn' ? 'ছবি তুলুন' : 'Capture'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backText}>
            {language === 'bn' ? 'ফিরে যান' : 'Back'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  woundTop: {flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12},
  angleTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  angleTabOn: {borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.15)'},
  angleTabT: {color: 'rgba(248,250,252,0.65)', fontWeight: '800', fontSize: 12},
  angleTabTOn: {color: '#F8FAFC'},
  silhouetteHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    textAlign: 'center',
    color: 'rgba(248,250,252,0.55)',
    fontSize: 12,
    fontWeight: '700',
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    paddingHorizontal: 24,
  },
  thumbSlot: {alignItems: 'center'},
  thumbCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOk: {borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.15)'},
  thumbNum: {color: '#E2E8F0', fontWeight: '900', fontSize: 14},
  thumbLbl: {marginTop: 4, color: '#86EFAC', fontWeight: '900'},
  previewFlash: {borderColor: 'rgba(34,197,94,0.9)'},
  reviewBtn: {
    marginTop: 12,
    marginHorizontal: 24,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#059669',
  },
  reviewBtnText: {color: '#F8FAFC', fontWeight: '900', fontSize: 15},
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  kicker: {
    color: 'rgba(248,250,252,0.72)',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardTitle: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  cardSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(248,250,252,0.72)',
    lineHeight: 19,
  },
  cardNote: {
    marginTop: 10,
    fontSize: 12.5,
    color: 'rgba(191,219,254,0.9)',
    lineHeight: 17,
  },
  previewBox: {
    marginTop: 14,
    marginHorizontal: 24,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(2,6,23,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    alignItems: 'center',
  },
  previewInner: {
    height: 280,
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    overflow: 'hidden',
  },
  previewHint: {
    marginTop: 10,
    color: 'rgba(248,250,252,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  captureBtn: {
    marginTop: 14,
    marginHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    alignItems: 'center',
  },
  captureBtnDisabled: {
    backgroundColor: 'rgba(148,163,184,0.25)',
  },
  analyzingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  captureText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
  },
  backBtn: {
    marginTop: 12,
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
  },
  backText: {fontSize: 15, fontWeight: '900', color: '#F8FAFC'},
});
