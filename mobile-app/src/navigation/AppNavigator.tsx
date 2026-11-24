// mobile-app/src/navigation/AppNavigator.tsx
// Complete navigation structure for DiabetesCare AI v4.0 Mobile App & Clinical Command Portal

import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import PortalLoginScreen from '../screens/PortalLoginScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import LoginScreen from '../screens/LoginScreen';
import DoctorCommandHubScreen from '../screens/DoctorCommandHubScreen';
import PatientRegistrationScreen from '../screens/PatientRegistrationScreen';
import PhotoFlowScreen from '../screens/PhotoFlowScreen';
import CaptureScreen from '../screens/CaptureScreen';
import ReviewScreen from '../screens/ReviewScreen';
import SuccessScreen from '../screens/SuccessScreen';

// v4.0 4-Role Workflow Screens
import DoctorHomeScreen from '../screens/doctor/DoctorHomeScreen';
import DoctorQueueScreen from '../screens/doctor/DoctorQueueScreen';
import ReportUploadScreen from '../screens/doctor/ReportUploadScreen';
import ClinicalNoteScreen from '../screens/doctor/ClinicalNoteScreen';
import FieldWorkerHomeScreen from '../screens/field_worker/FieldWorkerHomeScreen';
import ModeratorHomeScreen from '../screens/moderator/ModeratorHomeScreen';
import ModeratorReviewScreen from '../screens/moderator/ModeratorReviewScreen';
import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import PatientDetailsForm from '../screens/shared/PatientDetailsForm';
import ThreePhotoCapture from '../screens/shared/ThreePhotoCapture';
import ReviewAndSubmitScreen from '../screens/shared/ReviewAndSubmitScreen';
import SubmissionResultScreen from '../screens/shared/SubmissionResultScreen';

import type {
  AppRole,
  CapturedPhoto,
  ClinicalNoteDraft,
  MedicalReportFile,
  PatientDetailsDraft,
  SubmissionRecord,
} from '../types/app';

// ── Route Param Definitions ────────────────────────────────────────────────
export type RootStackParamList = {
  PortalLogin: undefined;
  RoleSelect: undefined;
  Login: {role: AppRole};
  DoctorHome: undefined;
  DoctorQueue: undefined;
  FieldWorkerHome: undefined;
  ModeratorHome: undefined;
  ModeratorReview: {submission: SubmissionRecord};
  AdminHome: undefined;
  PatientDetailsForm: {
    role: AppRole;
    isFollowup?: boolean;
    patientId?: string;
  };
  ThreePhotoCapture: {
    role: AppRole;
    submissionId?: string;
    patientId?: string;
    patientDetails?: PatientDetailsDraft;
  };
  ReportUpload: {
    role: AppRole;
    submissionId: string;
    patientId?: string;
    patientDetails: PatientDetailsDraft;
    photos: CapturedPhoto[];
  };
  ClinicalNote: {
    mode?: 'own' | 'validate';
    role?: AppRole;
    submissionId: string;
    patientId?: string;
    patientDetails?: PatientDetailsDraft;
    photos?: CapturedPhoto[];
    reports?: MedicalReportFile[];
  };
  ReviewAndSubmit: {
    role: AppRole;
    submissionId: string;
    patientId?: string;
    patientDetails: PatientDetailsDraft;
    photos: CapturedPhoto[];
    reports?: MedicalReportFile[];
    clinicalNote?: ClinicalNoteDraft;
  };
  SubmissionResult: {
    role: AppRole;
    submission?: SubmissionRecord;
  };

  // Existing Clinical Command Hub & Capture Routes
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
  Success: {patientId: string; visitId: string};
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const NAVY = '#0B132B';

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="PortalLogin"
        screenOptions={{
          headerStyle: {backgroundColor: NAVY},
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {fontWeight: '700', fontSize: 16},
          headerBackTitleVisible: false,
        }}>
        <Stack.Screen
          name="PortalLogin"
          component={PortalLoginScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="RoleSelect"
          component={RoleSelectScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="DoctorHome"
          component={DoctorHomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="DoctorQueue"
          component={DoctorQueueScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="FieldWorkerHome"
          component={FieldWorkerHomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ModeratorHome"
          component={ModeratorHomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ModeratorReview"
          component={ModeratorReviewScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="AdminHome"
          component={AdminHomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="PatientDetailsForm"
          component={PatientDetailsForm}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ThreePhotoCapture"
          component={ThreePhotoCapture}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ReportUpload"
          component={ReportUploadScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ClinicalNote"
          component={ClinicalNoteScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ReviewAndSubmit"
          component={ReviewAndSubmitScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="SubmissionResult"
          component={SubmissionResultScreen}
          options={{headerShown: false}}
        />

        {/* Existing Clinical Command Hub & Capture Routes */}
        <Stack.Screen
          name="DoctorCommandHub"
          component={DoctorCommandHubScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="PatientRegistration"
          component={PatientRegistrationScreen}
          options={{title: 'Patient Registration'}}
        />
        <Stack.Screen
          name="PhotoFlow"
          component={PhotoFlowScreen}
          options={{title: 'Photo Collection Checklist'}}
        />
        <Stack.Screen
          name="Capture"
          component={CaptureScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Review"
          component={ReviewScreen}
          options={{title: 'AI Analysis & Review'}}
        />
        <Stack.Screen
          name="Success"
          component={SuccessScreen}
          options={{title: 'Collection Complete', headerLeft: () => null}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
