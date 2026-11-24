import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {
  AppRole,
  CapturedPhoto,
  PatientDetailsDraft,
  PhotoAngleType,
} from '../../types/app';
import {
  createSubmission,
  resolvePhotoUri,
  uploadSubmissionPhoto,
} from '../../services/v4WorkflowService';
import {V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'ThreePhotoCapture'>;
};

const PHOTO_GUIDE: Array<{
  photoNumber: 1 | 2 | 3;
  photoType: PhotoAngleType;
  title: string;
  instruction: string;
  badge: string;
}> = [
  {
    photoNumber: 1,
    photoType: 'distant',
    title: 'Photo 1 · Full View (Distance)',
    instruction:
      'Full View — Show the whole body part. Place coin beside the area.',
    badge: 'Distance Shot',
  },
  {
    photoNumber: 2,
    photoType: 'medium',
    title: 'Photo 2 · Medium View (Closer)',
    instruction:
      'Medium View — Area should fill about half the frame. Coin beside area.',
    badge: 'Closer Shot',
  },
  {
    photoNumber: 3,
    photoType: 'close',
    title: 'Photo 3 · Close-up (Even Closer)',
    instruction:
      'Close-up — Area fills the frame, sharp focus. Coin beside area.',
    badge: 'Macro Focus',
  },
];

async function extractBase64(asset: Asset): Promise<string | undefined> {
  if (asset.base64) {
    return asset.base64;
  }
  if (asset.uri) {
    try {
      const cleanUri =
        Platform.OS === 'android' && asset.uri.startsWith('file://')
          ? asset.uri.replace('file://', '')
          : asset.uri;
      return await RNFS.readFile(cleanUri, 'base64');
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export default function ThreePhotoCapture({navigation, route}: Props) {
  const params = (route.params || {}) as {
    role?: AppRole;
    submissionId?: string;
    patientId?: string;
    patientDetails?: PatientDetailsDraft;
  };
  const role: AppRole = params.role || 'field_worker';
  const [submissionId, setSubmissionId] = useState<string | undefined>(
    params.submissionId,
  );
  const [patientId, setPatientId] = useState<string | undefined>(
    params.patientId || params.patientDetails?.patientId,
  );
  const patientDetails: PatientDetailsDraft = params.patientDetails || {
    patientName: 'Follow-up Patient',
    patientId: params.patientId,
    age: 50,
    weightKg: 65,
    bpSystolic: 120,
    bpDiastolic: 80,
    bloodSugar: 140,
    comorbidities: [],
    isFollowup: true,
  };

  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingAsset, setPendingAsset] = useState<CapturedPhoto | null>(null);
  const [keptPhotos, setKeptPhotos] = useState<
    Record<number, CapturedPhoto | undefined>
  >({});
  const [uploading, setUploading] = useState(false);

  const currentStep = PHOTO_GUIDE[activeIndex];
  const completedCount = [1, 2, 3].filter(n => Boolean(keptPhotos[n])).length;
  const allKept = completedCount === 3;

  const ensureSubmissionCreated = useCallback(async (): Promise<{
    sid: string;
    pid: string;
  }> => {
    if (submissionId && patientId) {
      return {sid: submissionId, pid: patientId};
    }
    const created = await createSubmission(patientDetails);
    setSubmissionId(created.submission_id);
    setPatientId(created.patient_id);
    return {sid: created.submission_id, pid: created.patient_id};
  }, [submissionId, patientId, patientDetails]);

  const handleAssetPicked = useCallback(
    async (asset?: Asset) => {
      if (!asset?.uri) {
        return;
      }
      const b64 = await extractBase64(asset);
      setPendingAsset({
        photoNumber: currentStep.photoNumber,
        photoType: currentStep.photoType,
        uri: asset.uri,
        base64: b64,
        fileName:
          asset.fileName ||
          `photo_${currentStep.photoNumber}_${currentStep.photoType}.jpg`,
        mimeType: asset.type || 'image/jpeg',
      });
    },
    [currentStep],
  );

  const openCamera = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission Required',
            message:
              'DiabetesCare AI needs camera access to capture the 3 guided wound photos.',
            buttonPositive: 'Allow',
            buttonNegative: 'Cancel',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Camera Permission Denied',
            'You can still upload an image from your device gallery.',
          );
          return;
        }
      } catch {
        // continue
      }
    }

    launchCamera(
      {
        mediaType: 'photo',
        cameraType: 'back',
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        includeBase64: true,
        saveToPhotos: false,
      },
      res => {
        if (res.didCancel) {
          return;
        }
        if (res.errorCode) {
          Alert.alert(
            'Camera Error',
            res.errorMessage || 'Could not open camera.',
          );
          return;
        }
        handleAssetPicked(res.assets?.[0]);
      },
    );
  }, [handleAssetPicked]);

  const openGallery = useCallback(() => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
        includeBase64: true,
      },
      res => {
        if (res.didCancel) {
          return;
        }
        if (res.errorCode) {
          Alert.alert(
            'Gallery Error',
            res.errorMessage || 'Could not select image.',
          );
          return;
        }
        handleAssetPicked(res.assets?.[0]);
      },
    );
  }, [handleAssetPicked]);

  const keepAndUpload = useCallback(async () => {
    if (!pendingAsset) {
      return;
    }
    setUploading(true);
    try {
      const {sid} = await ensureSubmissionCreated();
      const uploadRes = await uploadSubmissionPhoto(sid, pendingAsset);
      const saved: CapturedPhoto = {
        ...pendingAsset,
        uploaded: true,
        fileUrl: uploadRes?.file_url,
        annotatedUrl: uploadRes?.annotated_url,
        qualityPassed:
          uploadRes?.quality_passed === undefined
            ? true
            : Boolean(uploadRes.quality_passed),
        blurScore: uploadRes?.blur_score,
        coinDetected: uploadRes?.coin_detected,
        aiMessage: uploadRes?.message,
      };
      setKeptPhotos(prev => ({
        ...prev,
        [currentStep.photoNumber]: saved,
      }));
      setPendingAsset(null);
      if (activeIndex < 2) {
        setActiveIndex(activeIndex + 1);
      }
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err?.message || 'Could not upload photo to server.',
      );
    } finally {
      setUploading(false);
    }
  }, [pendingAsset, ensureSubmissionCreated, currentStep, activeIndex]);

  const proceedNext = () => {
    if (!allKept) {
      Alert.alert(
        '3 Photos Required',
        'Capture and keep all 3 photos (Distance, Closer, Even Closer) before proceeding.',
      );
      return;
    }
    const photos = [keptPhotos[1]!, keptPhotos[2]!, keptPhotos[3]!];
    const sharedParams = {
      role,
      submissionId,
      patientId,
      patientDetails,
      photos,
    };
    if (role === 'doctor') {
      navigation.navigate('ReportUpload', sharedParams);
    } else {
      navigation.navigate('ReviewAndSubmit', sharedParams);
    }
  };

  const activeKept = keptPhotos[currentStep.photoNumber];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.stepPill}>
            Photos: {completedCount} / 3 Completed
          </Text>
        </View>

        <Text style={styles.title}>Guided 3-Photo Capture</Text>
        {patientId ? (
          <Text style={styles.patientMeta}>
            Patient: {patientDetails.patientName} · ID: {patientId}
          </Text>
        ) : null}

        {/* Step Tabs */}
        <View style={styles.tabsRow}>
          {PHOTO_GUIDE.map((step, idx) => {
            const done = Boolean(keptPhotos[step.photoNumber]);
            const selected = idx === activeIndex;
            return (
              <TouchableOpacity
                key={step.photoNumber}
                style={[
                  styles.tab,
                  selected && styles.tabActive,
                  done && !selected && styles.tabDone,
                ]}
                onPress={() => {
                  setPendingAsset(null);
                  setActiveIndex(idx);
                }}>
                <Text style={styles.tabText}>
                  {done ? '✓ ' : ''}Photo {step.photoNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active Step Card */}
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Text style={styles.cardTitle}>{currentStep.title}</Text>
            <View style={styles.angleBadge}>
              <Text style={styles.angleBadgeText}>{currentStep.badge}</Text>
            </View>
          </View>
          <Text style={styles.instruction}>{currentStep.instruction}</Text>

          {pendingAsset ? (
            <View style={styles.previewWrap}>
              <Image
                source={{uri: pendingAsset.uri}}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.retakeBtn]}
                  disabled={uploading}
                  onPress={() => setPendingAsset(null)}>
                  <Text style={styles.actionBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.keepBtn]}
                  disabled={uploading}
                  onPress={keepAndUpload}>
                  {uploading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>Keep & Upload ✓</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : activeKept ? (
            <View style={styles.previewWrap}>
              <Image
                source={{
                  uri:
                    resolvePhotoUri({
                      annotated_url: activeKept.annotatedUrl,
                      file_url: activeKept.fileUrl,
                    }) || activeKept.uri,
                }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.qualityBanner}>
                <Text style={styles.qualityBannerText}>
                  {activeKept.qualityPassed !== false
                    ? '✓ Uploaded · AI Quality Check Passed'
                    : '⚠ Uploaded · Quality Warning'}
                  {activeKept.coinDetected ? ' · Coin Reference Detected' : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, styles.retakeBtn, {marginTop: 10}]}
                onPress={() =>
                  setKeptPhotos(prev => ({
                    ...prev,
                    [currentStep.photoNumber]: undefined,
                  }))
                }>
                <Text style={styles.actionBtnText}>Retake This Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureButtons}>
              <TouchableOpacity style={styles.cameraBtn} onPress={openCamera}>
                <Text style={styles.cameraBtnText}>📷 Open Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.galleryBtn} onPress={openGallery}>
                <Text style={styles.galleryBtnText}>
                  🖼️ Upload Image from Device
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Do's and Don'ts */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Photo Protocol (Do's & Don'ts)</Text>
          <Text style={styles.tipsText}>
            ✓ Use bright, even lighting and place a coin beside the affected area.
            {'\n'}✗ Avoid blurry shots, heavy shadows, filters, or covering the
            lesion.
          </Text>
        </View>

        {/* Summary Thumbnails */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Captured Photos Summary</Text>
          <View style={styles.thumbsRow}>
            {PHOTO_GUIDE.map(step => {
              const item = keptPhotos[step.photoNumber];
              return (
                <TouchableOpacity
                  key={step.photoNumber}
                  style={styles.thumbSlot}
                  onPress={() => {
                    setPendingAsset(null);
                    setActiveIndex(step.photoNumber - 1);
                  }}>
                  {item ? (
                    <Image
                      source={{uri: item.uri}}
                      style={styles.thumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbEmpty}>
                      <Text style={styles.thumbEmptyText}>
                        #{step.photoNumber}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.thumbLabel}>{step.badge}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!allKept || uploading}
          style={[styles.proceedBtn, !allKept && styles.proceedDisabled]}
          onPress={proceedNext}>
          <Text style={styles.proceedText}>
            {role === 'doctor'
              ? 'Proceed to Medical Reports →'
              : 'Proceed to Review & Submit →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: 10,
  },
  backText: {color: '#93C5FD', fontSize: 15, fontWeight: '800'},
  stepPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    color: '#93C5FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {fontSize: 24, fontWeight: '900', color: V4_COLORS.text},
  patientMeta: {
    marginTop: 4,
    fontSize: 13,
    color: V4_COLORS.mutedText,
    marginBottom: 12,
  },
  tabsRow: {flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 14},
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    backgroundColor: V4_COLORS.card,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: V4_COLORS.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  tabDone: {
    borderColor: 'rgba(34, 197, 94, 0.5)',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  tabText: {color: V4_COLORS.text, fontWeight: '800', fontSize: 13},
  card: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {fontSize: 17, fontWeight: '900', color: V4_COLORS.text, flex: 1},
  angleBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  angleBadgeText: {color: '#FBBF24', fontSize: 11, fontWeight: '800'},
  instruction: {
    marginTop: 8,
    fontSize: 14,
    color: V4_COLORS.mutedText,
    lineHeight: 20,
    marginBottom: 16,
  },
  captureButtons: {gap: 10},
  cameraBtn: {
    backgroundColor: V4_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cameraBtnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
  galleryBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    paddingVertical: 13,
    alignItems: 'center',
  },
  galleryBtnText: {color: '#CBD5E1', fontWeight: '800', fontSize: 14},
  previewWrap: {alignItems: 'center'},
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#020617',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  retakeBtn: {backgroundColor: '#334155', width: '100%'},
  keepBtn: {backgroundColor: V4_COLORS.success},
  actionBtnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 14},
  qualityBanner: {
    marginTop: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: '100%',
  },
  qualityBannerText: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  tipsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 12,
    marginBottom: 14,
  },
  tipsTitle: {color: '#93C5FD', fontWeight: '800', fontSize: 12, marginBottom: 4},
  tipsText: {color: V4_COLORS.mutedText, fontSize: 12, lineHeight: 18},
  summaryCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
    marginBottom: 16,
  },
  summaryTitle: {
    color: V4_COLORS.text,
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 10,
  },
  thumbsRow: {flexDirection: 'row', gap: 10},
  thumbSlot: {flex: 1, alignItems: 'center'},
  thumbImg: {
    width: '100%',
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  thumbEmpty: {
    width: '100%',
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: V4_COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 18, 32, 0.6)',
  },
  thumbEmptyText: {color: V4_COLORS.mutedText, fontWeight: '800'},
  thumbLabel: {
    marginTop: 4,
    fontSize: 11,
    color: V4_COLORS.mutedText,
    fontWeight: '700',
  },
  proceedBtn: {
    backgroundColor: V4_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  proceedDisabled: {opacity: 0.45},
  proceedText: {color: '#FFFFFF', fontWeight: '900', fontSize: 16},
});
