
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SkinResult'
>;

type ScreenRoute = RouteProp<RootStackParamList, 'SkinResult'>;

type Props = {
  navigation: NavigationProp;
  route: ScreenRoute;
};

export default function SkinResultScreen({
  navigation,
  route,
}: Props) {
  const {result, bodyPart, descriptors} = route.params;

  const topScores = Object.entries(result.class_scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Skin Screening Result</Text>

        <Text style={styles.label}>Predicted category</Text>
        <Text style={styles.prediction}>
          {result.predicted_class}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Assessment details</Text>
          <Text style={styles.detail}>
            Body part: {bodyPart}
          </Text>
          <Text style={styles.detail}>
            Visible features: {descriptors.join(', ')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Top model scores
        </Text>

        {topScores.map(([className, score]) => (
          <View key={className} style={styles.scoreRow}>
            <Text style={styles.scoreName}>{className}</Text>
            <Text style={styles.scoreValue}>
              {(score * 100).toFixed(1)}%
            </Text>
          </View>
        ))}

        <Text style={styles.note}>
          These scores are uncalibrated model outputs, not clinical
          probabilities or measures of diagnostic certainty.
        </Text>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>
            Important medical information
          </Text>
          <Text style={styles.warningText}>
            {result.disclaimer}
          </Text>
          <Text style={styles.warningText}>
            This screening result cannot confirm or rule out a
            skin condition. Consult a qualified healthcare
            professional for diagnosis and treatment advice.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.replace('SkinAssessment')}>
          <Text style={styles.primaryButtonText}>
            Assess another image
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  label: {
    marginTop: 18,
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  prediction: {
    marginTop: 8,
    fontSize: 23,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  card: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#111B2D',
  },
  detail: {
    marginTop: 8,
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#263449',
  },
  scoreName: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 14,
  },
  scoreValue: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  note: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  warningCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#292315',
    borderWidth: 1,
    borderColor: '#78612D',
  },
  warningTitle: {
    color: '#FDE68A',
    fontWeight: '900',
    fontSize: 15,
  },
  warningText: {
    marginTop: 8,
    color: '#FDECC8',
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 24,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  backText: {
    marginTop: 18,
    textAlign: 'center',
    color: '#93C5FD',
    fontWeight: '700',
  },
});
