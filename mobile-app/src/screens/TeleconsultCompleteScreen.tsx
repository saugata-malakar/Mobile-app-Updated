import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {CommonActions, useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';
import type {TeleconsultPrescription} from '../types/teleconsult';
import {getTeleconsult, rateTeleconsult} from '../services/teleconsultService';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TeleconsultComplete'>;

export default function TeleconsultCompleteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const teleconsultId: string = route.params?.teleconsultId;
  const lang: 'en' | 'bn' = route.params?.language === 'bn' ? 'bn' : 'en';

  const [rx, setRx] = useState<TeleconsultPrescription | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!teleconsultId) {
      return;
    }
    try {
      const d = await getTeleconsult(teleconsultId);
      setRx(d.prescription ?? null);
    } catch {
      setRx(null);
    } finally {
      setLoading(false);
    }
  }, [teleconsultId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const t = {
    title: lang === 'bn' ? 'আপনার পরামর্শ সম্পন্ন' : 'Your consultation is complete',
    rate: lang === 'bn' ? 'পরামর্শ কেমন ছিল?' : 'How was your consultation?',
    fb: lang === 'bn' ? 'মতামত (ঐচ্ছিক)' : 'Optional feedback',
    submit: lang === 'bn' ? 'রেটিং জমা দিন' : 'Submit rating',
    home: lang === 'bn' ? 'হোমে ফিরুন' : 'Return home',
    rxTitle: lang === 'bn' ? 'প্রেসক্রিপশন' : 'Prescription preview',
    rxTap: lang === 'bn' ? 'সম্পূর্ণ দেখতে ট্যাপ করুন' : 'Tap for full details',
  };

  const onSubmit = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert(
        lang === 'bn' ? 'রেটিং' : 'Rating',
        lang === 'bn' ? '১ থেকে ৫ তারা বেছে নিন।' : 'Choose 1–5 stars.',
      );
      return;
    }
    setSubmitting(true);
    try {
      await rateTeleconsult(teleconsultId, {rating, feedback: feedback.trim() || undefined});
      navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'PatientHome'}]}));
    } catch (e: any) {
      Alert.alert(
        'Error',
        String(e?.response?.data?.error?.message ?? 'Could not submit rating'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openRx = () => {
    if (rx) {
      navigation.navigate('PrescriptionDetail', {prescription: rx, language: lang});
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t.title}</Text>

        {loading ? (
          <ActivityIndicator style={{marginTop: 16}} color="#93C5FD" />
        ) : rx ? (
          <TouchableOpacity style={styles.rxCard} onPress={openRx} activeOpacity={0.9}>
            <Text style={styles.rxTitle}>{t.rxTitle}</Text>
            {rx.diagnosis ? <Text style={styles.rxLine}>{rx.diagnosis}</Text> : null}
            <Text style={styles.rxHint}>{t.rxTap}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.muted}>
            {lang === 'bn'
              ? 'কোনো প্রেসক্রিপশন এখনো যুক্ত নেই।'
              : 'No prescription is attached to this visit yet.'}
          </Text>
        )}

        <Text style={styles.section}>{t.rate}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setRating(n)} style={styles.starHit}>
              <Text style={[styles.star, rating >= n && styles.starOn]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>{t.fb}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder={lang === 'bn' ? 'লিখুন…' : 'Share feedback…'}
          placeholderTextColor="rgba(148,163,184,0.85)"
          value={feedback}
          onChangeText={setFeedback}
        />

        <TouchableOpacity
          style={[styles.primary, submitting && {opacity: 0.7}]}
          disabled={submitting}
          onPress={onSubmit}>
          {submitting ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={styles.primaryText}>{t.submit}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() =>
            navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'PatientHome'}]}))
          }>
          <Text style={styles.secondaryText}>{t.home}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  scroll: {padding: 20, paddingBottom: 32},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC'},
  muted: {marginTop: 12, color: 'rgba(148,163,184,0.95)', lineHeight: 20},
  rxCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.45)',
  },
  rxTitle: {color: '#BFDBFE', fontWeight: '900', marginBottom: 8},
  rxLine: {color: '#F8FAFC', fontSize: 15, lineHeight: 22},
  rxHint: {marginTop: 10, color: 'rgba(248,250,252,0.8)', fontSize: 13},
  section: {marginTop: 22, marginBottom: 8, color: '#94A3B8', fontWeight: '800'},
  stars: {flexDirection: 'row', gap: 6},
  starHit: {padding: 6},
  star: {fontSize: 36, color: 'rgba(148,163,184,0.35)'},
  starOn: {color: '#FBBF24'},
  input: {
    minHeight: 80,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    color: '#F8FAFC',
    textAlignVertical: 'top',
  },
  primary: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  secondary: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  secondaryText: {color: '#E2E8F0', fontWeight: '800'},
});
