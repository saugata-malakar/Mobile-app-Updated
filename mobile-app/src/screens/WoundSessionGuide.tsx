import React, {useRef, useState} from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WoundSessionGuide'>;
type Rt = RouteProp<RootStackParamList, 'WoundSessionGuide'>;

const STEPS = [
  {
    n: 1,
    title: 'Clean the area',
    body: 'Gently clean around the wound with clean water. Pat dry.',
  },
  {
    n: 2,
    title: 'Find good lighting',
    body: 'Sit near a window or in a bright room. Turn on room lights.',
  },
  {
    n: 3,
    title: 'Place the coin',
    body: 'Place a 1 rupee coin flat on the skin next to your wound, touching the wound edge.',
  },
  {
    n: 4,
    title: 'Take 3 photographs',
    body: 'We will take 3 photographs — from the top, from the left, from the right.',
  },
];

const W = Dimensions.get('window').width;

export default function WoundSessionGuide({navigation, route}: {navigation: Nav; route: Rt}) {
  const {wound_site_id, wound_site_label, language, screeningContext} = route.params;
  const lang = language === 'bn' ? 'bn' : 'en';
  const ctx =
    screeningContext ??
    ({
      sessionRole: 'patient' as const,
      patientId: wound_site_id,
      patientName: wound_site_label,
      followUp: true,
      submissionMethod: 'PATIENT_SELF' as const,
      woundSiteId: wound_site_id,
      woundSiteLabel: wound_site_label,
    });
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / W));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.kicker}>{wound_site_label}</Text>
      <Text style={styles.title}>Before you photograph</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{maxHeight: 320}}>
        {STEPS.map(s => (
          <View key={s.n} style={[styles.page, {width: W - 36}]}>
            <Text style={styles.stepNum}>Step {s.n}</Text>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepBody}>{s.body}</Text>
            {s.n === 3 ? (
              <TouchableOpacity
                style={styles.link}
                onPress={() => navigation.navigate('CoinPlacementGuide', {language: lang})}>
                <Text style={styles.linkText}>Show me how (coin)</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>

      <TouchableOpacity
        style={styles.primary}
        onPress={() =>
          navigation.navigate('CameraScreen', {
            condition: 'wound',
            language: lang,
            screeningContext: ctx,
            woundCameraFlow: {
              woundSiteId: wound_site_id,
              woundSiteLabel: wound_site_label,
              angles: ['TOP_DOWN', 'LEFT_45', 'RIGHT_45'],
            },
          })
        }>
        <Text style={styles.primaryText}>{"I'm ready — start photographing"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220', padding: 18},
  kicker: {color: '#93C5FD', fontWeight: '800', marginBottom: 4},
  title: {fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginBottom: 12},
  page: {
    paddingRight: 12,
    paddingVertical: 8,
  },
  stepNum: {color: 'rgba(148,163,184,0.95)', fontWeight: '800', marginBottom: 6},
  stepTitle: {fontSize: 18, fontWeight: '900', color: '#F8FAFC', marginBottom: 8},
  stepBody: {color: 'rgba(248,250,252,0.78)', lineHeight: 22},
  link: {marginTop: 12},
  linkText: {color: '#60A5FA', fontWeight: '900'},
  dots: {flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 12},
  dot: {width: 8, height: 8, borderRadius: 99, backgroundColor: 'rgba(148,163,184,0.35)'},
  dotOn: {backgroundColor: '#38BDF8'},
  primary: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryText: {color: '#F8FAFC', fontWeight: '900', fontSize: 16},
  back: {marginTop: 14, textAlign: 'center', color: '#94A3B8', fontWeight: '800'},
});
