import React, {useMemo, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';

type ConditionKey = 'skin' | 'eye' | 'wound';

type ConditionCard = {
  key: ConditionKey;
  titleEn: string;
  titleBn: string;
  color: string;
  borderColor: string;
};

export default function ConditionSelector() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const language: 'en' | 'bn' | undefined = route.params?.language;
  const screeningContext = route.params?.screeningContext;

  const cards: ConditionCard[] = useMemo(
    () => [
      {
        key: 'skin',
        titleEn: 'Skin condition',
        titleBn: 'ত্বকের সমস্যা',
        color: 'rgba(59,130,246,0.18)',
        borderColor: 'rgba(59,130,246,0.45)',
      },
      {
        key: 'eye',
        titleEn: 'Eye condition',
        titleBn: 'চোখের সমস্যা',
        color: 'rgba(34,197,94,0.18)',
        borderColor: 'rgba(34,197,94,0.45)',
      },
      {
        key: 'wound',
        titleEn: 'Wound',
        titleBn: 'ক্ষত',
        color: 'rgba(249,115,22,0.18)',
        borderColor: 'rgba(249,115,22,0.55)',
      },
    ],
    [],
  );

  const [selected, setSelected] = useState<ConditionKey | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.header}>
          {language === 'bn' ? 'সমস্যা নির্বাচন করুন' : 'Select a condition'}
        </Text>
        <Text style={styles.subheader}>
          {language === 'bn'
            ? 'আপনার স্ক্রিনিংয়ের জন্য একটি বিভাগ বাছাই করুন'
            : 'Choose a category to screen'}
        </Text>
        {screeningContext?.patientName ? (
          <View style={styles.patientChip}>
            <Text style={styles.patientChipText}>
              {language === 'bn' ? 'রোগী: ' : 'Patient: '}
              {screeningContext.patientName}
              {screeningContext.followUp
                ? language === 'bn'
                  ? ' · ফলো-আপ'
                  : ' · Follow-up'
                : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardsWrap}>
          {cards.map(card => {
            const isSelected = selected === card.key;
            return (
              <TouchableOpacity
                key={card.key}
                activeOpacity={0.9}
                onPress={() => setSelected(card.key)}
                style={[
                  styles.card,
                  {backgroundColor: card.color, borderColor: card.borderColor},
                  isSelected && styles.cardSelected,
                ]}>
                <Text style={styles.cardTitle}>
                  {card.titleEn} / {card.titleBn}
                </Text>
                <Text style={styles.cardHint}>
                  {isSelected
                    ? language === 'bn'
                      ? 'নির্বাচিত'
                      : 'Selected'
                    : language === 'bn'
                      ? 'ট্যাপ করে নির্বাচন করুন'
                      : 'Tap to select'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!selected}
            onPress={() =>
              navigation.navigate('CameraScreen', {
                condition: selected,
                language,
                screeningContext,
              })
            }
            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}>
            <Text style={styles.continueText}>
              {language === 'bn' ? 'চালিয়ে যান' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subheader: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(248,250,252,0.72)',
    marginBottom: 14,
  },
  patientChip: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
  },
  patientChipText: {
    color: '#BFDBFE',
    fontWeight: '800',
    fontSize: 13,
  },
  cardsWrap: {
    flex: 1,
    gap: 12,
    paddingTop: 4,
  },
  card: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  cardSelected: {
    transform: [{scale: 0.995}],
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  cardHint: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(248,250,252,0.72)',
  },
  footer: {
    paddingBottom: 14,
    paddingTop: 10,
  },
  continueBtn: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#2563EB',
  },
  continueBtnDisabled: {
    backgroundColor: 'rgba(148,163,184,0.25)',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
});
