import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
  MedicalReportFile,
  PatientDetailsDraft,
} from '../../types/app';
import {uploadSubmissionReport} from '../../services/v4WorkflowService';
import {V4_COLORS} from '../../theme/v4Theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, 'ReportUpload'>;
};

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

export default function ReportUploadScreen({navigation, route}: Props) {
  const params = (route.params || {}) as {
    role: AppRole;
    submissionId: string;
    patientId?: string;
    patientDetails: PatientDetailsDraft;
    photos: CapturedPhoto[];
  };

  const [reports, setReports] = useState<MedicalReportFile[]>([]);
  const [busy, setBusy] = useState(false);

  const attachAsset = async (asset?: Asset) => {
    if (!asset?.uri) {
      return;
    }
    setBusy(true);
    try {
      const b64 = await extractBase64(asset);
      const item: MedicalReportFile = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fileName: asset.fileName || `medical_report_${reports.length + 1}.jpg`,
        uri: asset.uri,
        mimeType: asset.type || 'image/jpeg',
        base64: b64,
      };
      const uploaded = await uploadSubmissionReport(params.submissionId, item);
      setReports(prev => [
        ...prev,
        {
          ...item,
          uploaded: true,
          fileUrl: uploaded?.file_url,
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err?.message || 'Could not upload medical report.',
      );
    } finally {
      setBusy(false);
    }
  };

  const pickReport = () => {
    Alert.alert(
      'Add Medical Report',
      'Choose how to attach an X-ray, lab report, or prescription:',
      [
        {
          text: 'Choose from Device Gallery',
          onPress: () =>
            launchImageLibrary(
              {
                mediaType: 'photo',
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.8,
                includeBase64: true,
              },
              res => {
                if (!res.didCancel && res.assets?.[0]) {
                  attachAsset(res.assets[0]);
                }
              },
            ),
        },
        {
          text: 'Take Photo of Report',
          onPress: () =>
            launchCamera(
              {
                mediaType: 'photo',
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.8,
                includeBase64: true,
              },
              res => {
                if (!res.didCancel && res.assets?.[0]) {
                  attachAsset(res.assets[0]);
                }
              },
            ),
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  };

  const removeReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const goNext = (attached: MedicalReportFile[]) => {
    navigation.navigate('ClinicalNote', {
      mode: 'own',
      role: params.role,
      submissionId: params.submissionId,
      patientId: params.patientId,
      patientDetails: params.patientDetails,
      photos: params.photos,
      reports: attached,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={V4_COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.stepPill}>Step 3 · Optional Reports</Text>
        </View>

        <Text style={styles.title}>Upload Previous Reports (Optional)</Text>
        <Text style={styles.sub}>
          Upload any existing X-rays, lab reports, or prescriptions
        </Text>

        <TouchableOpacity
          activeOpacity={0.88}
          disabled={busy}
          style={styles.uploadBtn}
          onPress={pickReport}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.uploadIcon}>📎</Text>
              <Text style={styles.uploadBtnText}>Add Medical Report</Text>
              <Text style={styles.uploadHint}>
                Tap to select from gallery or photograph a paper report
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.listCard}>
          <Text style={styles.listHeading}>
            Attached Reports ({reports.length})
          </Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>
              No previous reports attached yet. You can skip this step.
            </Text>
          ) : (
            reports.map(r => (
              <View key={r.id} style={styles.reportRow}>
                <Text style={styles.reportName} numberOfLines={1}>
                  📄 {r.fileName}
                </Text>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeReport(r.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.skipBtn}
            disabled={busy}
            onPress={() => goNext(reports)}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nextBtn}
            disabled={busy}
            onPress={() => goNext(reports)}>
            <Text style={styles.nextText}>Next: Clinical Note →</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 12,
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
  title: {fontSize: 23, fontWeight: '900', color: V4_COLORS.text},
  sub: {
    marginTop: 6,
    fontSize: 14,
    color: V4_COLORS.mutedText,
    marginBottom: 20,
    lineHeight: 20,
  },
  uploadBtn: {
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: V4_COLORS.primary,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  uploadIcon: {fontSize: 32, marginBottom: 8},
  uploadBtnText: {color: '#FFFFFF', fontWeight: '900', fontSize: 17},
  uploadHint: {
    color: V4_COLORS.mutedText,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: V4_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
    padding: 14,
    marginBottom: 20,
  },
  listHeading: {
    color: '#60A5FA',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  emptyText: {color: V4_COLORS.mutedText, fontSize: 13},
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.14)',
    gap: 10,
  },
  reportName: {color: V4_COLORS.text, fontSize: 14, flex: 1, fontWeight: '700'},
  removeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  removeText: {color: '#FCA5A5', fontSize: 12, fontWeight: '800'},
  bottomRow: {flexDirection: 'row', gap: 12},
  skipBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: V4_COLORS.cardBorder,
  },
  skipText: {color: V4_COLORS.text, fontWeight: '800', fontSize: 15},
  nextBtn: {
    flex: 2,
    backgroundColor: V4_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextText: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
});
