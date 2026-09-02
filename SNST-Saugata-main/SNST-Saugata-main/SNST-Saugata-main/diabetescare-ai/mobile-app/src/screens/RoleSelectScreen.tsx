import React from 'react';
import {SafeAreaView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RoleSelect'>;

export default function RoleSelectScreen({navigation}: {navigation: Nav}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Who is using the app?</Text>
        <Text style={styles.sub}>
          ASHA and patient modes are separate. Choose one to continue.
        </Text>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.card, styles.cardAsha]}
          onPress={() =>
            navigation.navigate('Login', {role: 'asha'})
          }>
          <Text style={styles.cardTitle}>ASHA worker</Text>
          <Text style={styles.cardHint}>
            Manage multiple patients, visits, and commission from your portal.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.card, styles.cardPatient]}
          onPress={() =>
            navigation.navigate('Login', {role: 'patient'})
          }>
          <Text style={styles.cardTitle}>Patient</Text>
          <Text style={styles.cardHint}>
            Use screening on your own—without an ASHA worker present.
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0B1220'},
  container: {flex: 1, padding: 22, paddingTop: 28},
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(248,250,252,0.72)',
    marginBottom: 22,
    lineHeight: 20,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
  },
  cardAsha: {
    backgroundColor: 'rgba(37,99,235,0.15)',
    borderColor: 'rgba(59,130,246,0.45)',
  },
  cardPatient: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  cardHint: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(248,250,252,0.78)',
    lineHeight: 19,
  },
});
