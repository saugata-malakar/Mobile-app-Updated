import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { launchCamera } from 'react-native-image-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  getSkinOptions,
  predictSkin,
  type SkinOptions,
} from '../services/skinClassifierApi';


type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SkinAssessment'
>;

type Props = {
  navigation: NavigationProp;
};

export default function SkinAssessmentScreen({ navigation }: Props) {
  const [options, setOptions] = useState<SkinOptions | null>(null);
  const [bodyPart, setBodyPart] = useState('');
  const [descriptors, setDescriptors] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    getSkinOptions()
      .then(data => {
        if (!active) {
          return;
        }

        setOptions(data);

        if (data.body_parts.length > 0) {
          setBodyPart(data.body_parts[0]);
        }
      })
      .catch(err => {
        if (active) {
          setError(
            err?.message || 'Unable to load skin assessment options.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingOptions(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleDescriptor = (descriptor: string) => {
    setDescriptors(current =>
      current.includes(descriptor)
        ? current.filter(item => item !== descriptor)
        : [...current, descriptor],
    );
  };


  const captureAndAnalyze = async () => {
    if (!bodyPart) {
      Alert.alert('Select a body part', 'Choose the affected body area.');
      return;
    }

    if (descriptors.length === 0) {
      Alert.alert(
        'Select a descriptor',
        'Select at least one visible skin feature.',
      );
      return;
    }

    try {
      setError('');

      // Request camera permission on Android
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message:
              'DiabetesCare AI needs camera access to capture skin images.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
            buttonNeutral: 'Ask Me Later',
          },
        );

        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Camera Permission Required',
            'Please allow camera access in your phone settings to capture a skin image.',
          );
          return;
        }
      }

      // Open camera after permission is granted
      const capture = await launchCamera({
        mediaType: 'photo',
        cameraType: 'back',
        quality: 0.9,
        saveToPhotos: false,
      });

      if (capture.didCancel) {
        return;
      }

      if (capture.errorCode) {
        Alert.alert(
          'Camera Error',
          capture.errorMessage || capture.errorCode,
        );
        return;
      }

      const imageUri = capture.assets?.[0]?.uri;

      if (!imageUri) {
        Alert.alert('No Image', 'The camera did not provide an image.');
        return;
      }

      // Send image to the skin classification backend
      setAnalyzing(true);

      const result = await predictSkin(
        imageUri,
        bodyPart,
        descriptors,
      );

      navigation.navigate('SkinResult', {
        result,
        bodyPart,
        descriptors,
      });

    } catch (err: any) {
      const message =
        err?.message || 'Unable to analyze the image. Please try again.';

      setError(message);
      Alert.alert('Skin Assessment Failed', message);

    } finally {
      setAnalyzing(false);
    }
  };


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">

      <Text style={styles.title}>Skin Assessment</Text>

      <Text style={styles.intro}>
        Select the affected body part and visible skin features.
        Then take a clear photo for experimental AI screening.
      </Text>

      {loadingOptions ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={styles.muted}>Loading assessment options...</Text>
        </View>
      ) : null}

      {!loadingOptions && options ? (
        <>
          <Text style={styles.sectionTitle}>1. Affected body part</Text>

          <View style={styles.optionsContainer}>
            {options.body_parts.map(item => {
              const selected = bodyPart === item;

              return (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setBodyPart(item)}
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                  ]}>
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}>
                    {selected ? '✓  ' : ''}
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>
            2. Visible skin features
          </Text>

          <Text style={styles.muted}>
            Select all features that you can observe.
          </Text>

          <View style={styles.optionsContainer}>
            {options.descriptors.map(item => {
              const selected = descriptors.includes(item);

              return (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleDescriptor(item)}
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                  ]}>
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}>
                    {selected ? '✓  ' : ''}
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.selectionSummary}>
            Selected features: {descriptors.length}
          </Text>
        </>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        disabled={loadingOptions || !options || analyzing}
        onPress={captureAndAnalyze}
        style={[
          styles.primaryButton,
          (loadingOptions || !options || analyzing) &&
          styles.buttonDisabled,
        ]}>
        {analyzing ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              Analyzing image...
            </Text>
          </View>
        ) : (
          <Text style={styles.primaryButtonText}>
            Open Camera and Analyze
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        This model provides experimental screening support only.
        Its output is not a diagnosis, and its scores are not
        calibrated clinical probabilities. Consult a qualified
        healthcare professional for medical assessment.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  intro: {
    marginTop: 10,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#CBD5E1',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  muted: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#111B2D',
  },
  optionSelected: {
    borderColor: '#60A5FA',
    backgroundColor: '#1E3A5F',
  },
  optionText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectionSummary: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 24,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  error: {
    marginTop: 14,
    color: '#FCA5A5',
    lineHeight: 20,
  },
  disclaimer: {
    marginTop: 18,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
});
