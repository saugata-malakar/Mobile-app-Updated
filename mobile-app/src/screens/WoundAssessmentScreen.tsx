// mobile-app/src/screens/WoundAssessmentScreen.tsx
// Dedicated Doctor & Researcher AI Model Assessment Workstation
// Allows clinicians to capture/upload wound photos and evaluate YOLO11 + SAM2 segmentation in real-time.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { DiabetesCareAPI } from '../services/api';

const NAVY_DARK = '#0B132B';
const CARD_BG = '#141E3C';
const BORDER_COLOR = '#23355E';
const EMERALD = '#10B981';
const AMBER = '#F59E0B';
const ROSE = '#EF4444';
const BLUE = '#3B82F6';
const SLATE_LIGHT = '#F8FAFC';
const SLATE_MUTED = '#94A3B8';

interface SegmentationResult {
  annotated_b64: string;
  mask_b64: string;
  area_cm2: number;
  length_mm: number;
  width_mm: number;
  perimeter_mm: number;
  confidence: number;
  tissue: {
    granulation_pct?: number;
    slough_pct?: number;
    necrotic_pct?: number;
  };
  num_lesions: number;
  method: string;
}

export default function WoundAssessmentScreen() {
  const navigation = useNavigation<any>();

  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [originalB64, setOriginalB64] = useState<string | null>(null);
  const [result, setResult] = useState<SegmentationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'overlay' | 'mask' | 'original'>('overlay');
  const [pixelsPerMm, setPixelsPerMm] = useState<number>(10.0);

  // ── Process Image with YOLO11 + SAM2 Backend ────────────────────────────
  const runSegmentation = useCallback(async (base64Data: string, uri?: string) => {
    setLoading(true);
    setResult(null);
    if (uri) setOriginalUri(uri);
    setOriginalB64(base64Data);

    try {
      const res = await DiabetesCareAPI.segmentWound(base64Data, pixelsPerMm, 0.15);
      if (res && res.success) {
        setResult(res);
        setActiveView('overlay');
      } else {
        Alert.alert('Inference Notice', 'Wound segmentor completed without primary contours. You can adjust sensitivity.');
      }
    } catch (err: any) {
      Alert.alert(
        'Backend Connection',
        err.message || 'Could not connect to FastAPI server. Please ensure START_SERVER.bat or USB reverse port 8000 is running.',
      );
    } finally {
      setLoading(false);
    }
  }, [pixelsPerMm]);

  // ── Launch Native Camera ────────────────────────────────────────────────
  const handleCaptureCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        cameraType: 'back',
        quality: 0.85,
        includeBase64: true,
      },
      (res) => {
        if (res.didCancel || !res.assets || res.assets.length === 0) return;
        const asset = res.assets[0];
        if (asset.base64) {
          runSegmentation(asset.base64, asset.uri);
        }
      },
    );
  };

  // ── Pick from Gallery ───────────────────────────────────────────────────
  const handlePickGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.85,
        includeBase64: true,
      },
      (res) => {
        if (res.didCancel || !res.assets || res.assets.length === 0) return;
        const asset = res.assets[0];
        if (asset.base64) {
          runSegmentation(asset.base64, asset.uri);
        }
      },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>AI Wound Assessment</Text>
          <Text style={styles.headerSubtitle}>YOLO11s + SAM2 Global-Local Workstation</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>Live AI</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Instruction Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🔬 Clinical Model Evaluation Section</Text>
          <Text style={styles.bannerText}>
            Capture or upload a patient wound image to test real-time wound detection, dual-tone boundary marking, binary segmentation masks, and clinical morphometrics.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleCaptureCamera}>
            <Text style={styles.btnIcon}>📸</Text>
            <Text style={styles.btnText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handlePickGallery}>
            <Text style={styles.btnIcon}>🖼️</Text>
            <Text style={styles.btnText}>Choose Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.loadingText}>Running YOLO11 Detector & SAM2 Global-Local Segmentor...</Text>
            <Text style={styles.loadingSub}>Analyzing contours, Feret calipers, and tissue colors</Text>
          </View>
        )}

        {/* Image Display & View Toggle */}
        {(result || originalUri) && !loading && (
          <View style={styles.imageCard}>
            {/* View Selector Tabs */}
            <View style={styles.viewTabs}>
              <TouchableOpacity
                style={[styles.tab, activeView === 'overlay' && styles.tabActive]}
                onPress={() => setActiveView('overlay')}
              >
                <Text style={[styles.tabText, activeView === 'overlay' && styles.tabTextActive]}>
                  🎯 Boundary Overlay
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeView === 'mask' && styles.tabActive]}
                onPress={() => setActiveView('mask')}
              >
                <Text style={[styles.tabText, activeView === 'mask' && styles.tabTextActive]}>
                  ⬛ Binary Mask
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeView === 'original' && styles.tabActive]}
                onPress={() => setActiveView('original')}
              >
                <Text style={[styles.tabText, activeView === 'original' && styles.tabTextActive]}>
                  📷 Original Photo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Display Image */}
            <View style={styles.imageView}>
              {activeView === 'overlay' && result?.annotated_b64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${result.annotated_b64}` }}
                  style={styles.renderedImage}
                  resizeMode="contain"
                />
              ) : activeView === 'mask' && result?.mask_b64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${result.mask_b64}` }}
                  style={styles.renderedImage}
                  resizeMode="contain"
                />
              ) : originalUri ? (
                <Image source={{ uri: originalUri }} style={styles.renderedImage} resizeMode="contain" />
              ) : originalB64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${originalB64}` }}
                  style={styles.renderedImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.placeholderText}>No photo loaded</Text>
              )}
            </View>

            <View style={styles.imageLegend}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>
                {activeView === 'overlay'
                  ? 'Red outer border + Bright yellow inner boundary marks ulcer margin'
                  : activeView === 'mask'
                  ? 'White = Segmented Ulcer Bed (1), Black = Surrounding Intact Skin (0)'
                  : 'Original Unmodified Clinical Capture'}
              </Text>
            </View>
          </View>
        )}

        {/* Clinical Measurements Cards */}
        {result && !loading && (
          <View style={styles.metricsContainer}>
            <Text style={styles.sectionHeading}>📊 Clinical Measurements & Morphometrics</Text>

            {/* Top Key Metrics Row */}
            <View style={styles.gridRow}>
              <View style={[styles.metricCard, { borderLeftColor: EMERALD }]}>
                <Text style={styles.metricLabel}>Wound Surface Area</Text>
                <Text style={[styles.metricVal, { color: EMERALD }]}>
                  {result.area_cm2.toFixed(3)} <Text style={styles.metricUnit}>cm²</Text>
                </Text>
                <Text style={styles.metricHint}>Calibrated 2D ulcer bed</Text>
              </View>

              <View style={[styles.metricCard, { borderLeftColor: BLUE }]}>
                <Text style={styles.metricLabel}>Model Confidence</Text>
                <Text style={[styles.metricVal, { color: BLUE }]}>
                  {Math.round(result.confidence * 100)}%
                </Text>
                <Text style={styles.metricHint}>YOLO11 Detection Certainty</Text>
              </View>
            </View>

            {/* Feret Dimensions Row */}
            <View style={styles.gridRow}>
              <View style={[styles.metricCard, { borderLeftColor: AMBER }]}>
                <Text style={styles.metricLabel}>Max Feret Length</Text>
                <Text style={[styles.metricVal, { color: AMBER }]}>
                  {result.length_mm.toFixed(1)} <Text style={styles.metricUnit}>mm</Text>
                </Text>
                <Text style={styles.metricHint}>Greatest caliper span</Text>
              </View>

              <View style={[styles.metricCard, { borderLeftColor: AMBER }]}>
                <Text style={styles.metricLabel}>Orthogonal Width</Text>
                <Text style={[styles.metricVal, { color: AMBER }]}>
                  {result.width_mm.toFixed(1)} <Text style={styles.metricUnit}>mm</Text>
                </Text>
                <Text style={styles.metricHint}>Perpendicular axis</Text>
              </View>
            </View>

            {/* Perimeter & Lesions */}
            <View style={styles.fullCard}>
              <View style={styles.metricRow}>
                <Text style={styles.rowLabel}>Perimeter (Margin Length):</Text>
                <Text style={styles.rowVal}>{result.perimeter_mm.toFixed(1)} mm</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.rowLabel}>Identified Lesion Count:</Text>
                <Text style={styles.rowVal}>{result.num_lesions}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.rowLabel}>Inference Pipeline:</Text>
                <Text style={[styles.rowVal, { color: EMERALD }]}>{result.method}</Text>
              </View>
            </View>

            {/* Tissue Composition Breakdown */}
            {result.tissue && (
              <View style={styles.fullCard}>
                <Text style={styles.cardHeaderTitle}>🥩 Tissue Composition Breakdown</Text>
                <View style={styles.tissueRow}>
                  <Text style={[styles.tissueLabel, { color: ROSE }]}>🔴 Granulation:</Text>
                  <Text style={styles.tissueVal}>{result.tissue.granulation_pct ?? 0}%</Text>
                </View>
                <View style={styles.tissueRow}>
                  <Text style={[styles.tissueLabel, { color: AMBER }]}>🟡 Slough:</Text>
                  <Text style={styles.tissueVal}>{result.tissue.slough_pct ?? 0}%</Text>
                </View>
                <View style={styles.tissueRow}>
                  <Text style={[styles.tissueLabel, { color: SLATE_MUTED }]}>⚫ Necrotic / Eschar:</Text>
                  <Text style={styles.tissueVal}>{result.tissue.necrotic_pct ?? 0}%</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Empty State Help */}
        {!result && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🦶</Text>
            <Text style={styles.emptyTitle}>Ready to Assess Model</Text>
            <Text style={styles.emptyText}>
              Tap "Take Photo" with your mobile camera or "Choose Gallery" to upload an ulcer image. The pipeline will automatically detect the wound boundary and render the segmented overlay.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NAVY_DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: '#0F1A3A',
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backBtnText: { color: BLUE, fontSize: 16, fontWeight: '700' },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { color: SLATE_LIGHT, fontSize: 16, fontWeight: '800' },
  headerSubtitle: { color: SLATE_MUTED, fontSize: 10, fontWeight: '500' },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusBadgeText: { color: EMERALD, fontSize: 11, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 40 },

  banner: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 16,
  },
  bannerTitle: { color: '#93C5FD', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  bannerText: { color: SLATE_MUTED, fontSize: 12, lineHeight: 17 },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  btnPrimary: { backgroundColor: BLUE },
  btnSecondary: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER_COLOR },
  btnIcon: { fontSize: 18 },
  btnText: { color: SLATE_LIGHT, fontWeight: '700', fontSize: 14 },

  loadingBox: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 16,
  },
  loadingText: { color: SLATE_LIGHT, fontSize: 14, fontWeight: '700', marginTop: 12 },
  loadingSub: { color: SLATE_MUTED, fontSize: 11, marginTop: 4 },

  imageCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
    marginBottom: 16,
  },
  viewTabs: {
    flexDirection: 'row',
    backgroundColor: '#0D162E',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: BLUE,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  tabText: { color: SLATE_MUTED, fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: '#60A5FA', fontWeight: '700' },

  imageView: {
    width: '100%',
    height: 300,
    backgroundColor: '#060B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  renderedImage: { width: '100%', height: '100%' },
  placeholderText: { color: SLATE_MUTED, fontSize: 12 },

  imageLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    backgroundColor: '#0E1736',
  },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ROSE },
  legendText: { color: SLATE_MUTED, fontSize: 11, flex: 1 },

  metricsContainer: { gap: 12 },
  sectionHeading: { color: SLATE_LIGHT, fontSize: 15, fontWeight: '800', marginBottom: 4 },

  gridRow: { flexDirection: 'row', gap: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderLeftWidth: 4,
  },
  metricLabel: { color: SLATE_MUTED, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  metricVal: { fontSize: 22, fontWeight: '800' },
  metricUnit: { fontSize: 12, fontWeight: '600', color: SLATE_MUTED },
  metricHint: { color: SLATE_MUTED, fontSize: 10, marginTop: 4 },

  fullCard: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  cardHeaderTitle: { color: SLATE_LIGHT, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: { color: SLATE_MUTED, fontSize: 12 },
  rowVal: { color: SLATE_LIGHT, fontSize: 12, fontWeight: '700' },

  tissueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  tissueLabel: { fontSize: 12, fontWeight: '600' },
  tissueVal: { color: SLATE_LIGHT, fontSize: 12, fontWeight: '700' },

  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  emptyIcon: { fontSize: 42, marginBottom: 12 },
  emptyTitle: { color: SLATE_LIGHT, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptyText: { color: SLATE_MUTED, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
