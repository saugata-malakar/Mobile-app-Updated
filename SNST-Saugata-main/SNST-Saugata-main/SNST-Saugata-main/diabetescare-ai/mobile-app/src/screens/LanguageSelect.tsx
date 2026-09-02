import React, {useCallback, useState} from 'react';
import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';

type Language = 'en' | 'bn';

export default function LanguageSelect() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const screeningContext = route.params?.screeningContext;
  const [saving, setSaving] = useState<Language | null>(null);

  const choose = useCallback(
    async (lang: Language) => {
      if (saving) {
        return;
      }

      setSaving(lang);
      try {
        navigation.navigate('ConditionSelector', {
          language: lang,
          screeningContext,
        });
      } catch {
        Alert.alert('Error', 'Could not save language selection.');
      } finally {
        setSaving(null);
      }
    },
    [navigation, saving, screeningContext],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Choose your language</Text>
      <Text style={styles.subheader}>আপনার ভাষা নির্বাচন করুন</Text>

      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.bigButton, styles.btnEnglish]}
        onPress={() => choose('en')}
        disabled={saving !== null}>
        <Text style={styles.btnTitle}>English</Text>
        <Text style={styles.btnHint}>
          {saving === 'en' ? 'Saving…' : 'Continue in English'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.bigButton, styles.btnBangla]}
        onPress={() => choose('bn')}
        disabled={saving !== null}>
        <Text style={styles.btnTitle}>বাংলা</Text>
        <Text style={styles.btnHint}>
          {saving === 'bn' ? 'Saving…' : 'বাংলায় এগিয়ে যান'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 28,
    backgroundColor: '#0B1220',
  },
  header: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  subheader: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(248,250,252,0.72)',
    marginBottom: 18,
  },
  bigButton: {
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginTop: 14,
    borderWidth: 1,
  },
  btnEnglish: {
    backgroundColor: '#111C33',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  btnBangla: {
    backgroundColor: '#122018',
    borderColor: 'rgba(34,197,94,0.35)',
  },
  btnTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  btnHint: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(248,250,252,0.72)',
  },
});
