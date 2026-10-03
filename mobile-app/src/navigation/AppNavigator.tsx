// mobile-app/src/navigation/AppNavigator.tsx
// Complete navigation structure for DiabetesCare AI Mobile App & Clinical Command Portal

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PortalLoginScreen from '../screens/PortalLoginScreen';
import DoctorCommandHubScreen from '../screens/DoctorCommandHubScreen';
import PatientRegistrationScreen from '../screens/PatientRegistrationScreen';
import PhotoFlowScreen from '../screens/PhotoFlowScreen';
import CaptureScreen from '../screens/CaptureScreen';
import ReviewScreen from '../screens/ReviewScreen';
import SuccessScreen from '../screens/SuccessScreen';

// ── Route Param Definitions ────────────────────────────────────────────────
export type RootStackParamList = {
  PortalLogin: undefined;
  DoctorCommandHub: {
    userRole?: 'doctor' | 'patient' | 'asha' | 'hospital_admin';
    userProfile?: any;
  };
  PatientRegistration: undefined;
  PhotoFlow: {
    patientId: string;
    visitId: string;
    operatorId: string;
    completedPhotoType?: 'overview' | 'close_up' | 'measurement';
    captureResult?: any;
  };
  Capture: {
    patientId: string;
    visitId: string;
    photoType: 'overview' | 'close_up' | 'measurement';
    operatorId: string;
    returnToPhotoFlow?: boolean;
  };
  Review: {
    patientId: string;
    visitId: string;
    photoType: 'overview' | 'close_up' | 'measurement';
    operatorId: string;
    captureResponse?: any;
    annotatedImageB64?: string;
    originalImageB64?: string;
    metadata?: any;
    measurements?: {
      length_mm?: number;
      width_mm?: number;
      area_cm2?: number;
      perimeter_mm?: number;
      confidence?: number;
      measurement_id?: string;
      wagner_grade?: number;
      grade_label?: string;
      recommendation?: string;
    };
  };
  Success: { patientId: string; visitId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const NAVY = '#0B132B';

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="PortalLogin"
        screenOptions={{
          headerStyle: { backgroundColor: NAVY },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerBackTitleVisible: false,
        }}>
        <Stack.Screen
          name="PortalLogin"
          component={PortalLoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorCommandHub"
          component={DoctorCommandHubScreen}
          options={{ headerShown: false }}
        />
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
