// mobile-app/src/navigation/AppNavigator.tsx
// Complete navigation structure for DiabetesCare AI Mobile App

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PatientRegistrationScreen from '../screens/PatientRegistrationScreen';
import PhotoFlowScreen from '../screens/PhotoFlowScreen';
import CaptureScreen from '../screens/CaptureScreen';
import ReviewScreen from '../screens/ReviewScreen';
import SuccessScreen from '../screens/SuccessScreen';

// ── Route Param Definitions ────────────────────────────────────────────────
export type RootStackParamList = {
  PatientRegistration: undefined;
  PhotoFlow: {
    patientId: string;
    visitId: string;
    operatorId: string;
  };
  Capture: {
    patientId: string;
    visitId: string;
    photoType: 'overview' | 'close_up' | 'measurement';
    operatorId: string;
  };
  Review: {
    patientId: string;
    visitId: string;
    photoType: 'overview' | 'close_up' | 'measurement';
    operatorId: string;
    captureResponse: any;
    annotatedImageB64: string;
    originalImageB64?: string;
    metadata?: any;
    measurements: {
      length_mm?: number;
      width_mm?: number;
      area_cm2?: number;
      perimeter_mm?: number;
      confidence?: number;
      measurement_id?: string;
    };
  };
  Success: { patientId: string; visitId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const NAVY = '#1F3864';

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="PatientRegistration"
        screenOptions={{
          headerStyle: { backgroundColor: NAVY },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitleVisible: false,
        }}>
        <Stack.Screen
          name="PatientRegistration"
          component={PatientRegistrationScreen}
          options={{ title: 'Patient Registration' }}
        />
        <Stack.Screen
          name="PhotoFlow"
          component={PhotoFlowScreen}
          options={{ title: 'Photo Collection Checklist' }}
        />
        <Stack.Screen
          name="Capture"
          component={CaptureScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Review"
          component={ReviewScreen}
          options={{ title: 'AI Analysis & Review' }}
        />
        <Stack.Screen
          name="Success"
          component={SuccessScreen}
          options={{ title: 'Collection Complete', headerLeft: () => null }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
