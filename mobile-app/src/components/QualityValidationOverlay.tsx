import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export type QualityBanner = {
  visible: boolean;
  tone: 'bad' | 'good';
  message: string;
};

type Props = {
  banner: QualityBanner;
  goodBadge?: boolean;
};

/** P13: overlay hints on top of camera preview (messages only; no frame processing in demo). */
export default function QualityValidationOverlay({banner, goodBadge}: Props) {
  if (goodBadge) {
    return (
      <View style={styles.goodWrap} pointerEvents="none">
        <Text style={styles.goodText}>✓ Good</Text>
      </View>
    );
  }
  if (!banner.visible) {
    return null;
  }
  return (
    <View
      style={[styles.banner, banner.tone === 'bad' ? styles.bannerBad : styles.bannerGood]}
      pointerEvents="none">
      <Text style={styles.bannerText}>{banner.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerBad: {
    backgroundColor: 'rgba(220,38,38,0.82)',
    borderColor: 'rgba(254,202,202,0.9)',
  },
  bannerGood: {
    backgroundColor: 'rgba(22,163,74,0.75)',
    borderColor: 'rgba(187,247,208,0.9)',
  },
  bannerText: {color: '#F8FAFC', fontWeight: '900', fontSize: 13, textAlign: 'center'},
  goodWrap: {
    position: 'absolute',
    top: 10,
    right: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(22,163,74,0.85)',
  },
  goodText: {color: '#F0FDF4', fontWeight: '900', fontSize: 13},
});
