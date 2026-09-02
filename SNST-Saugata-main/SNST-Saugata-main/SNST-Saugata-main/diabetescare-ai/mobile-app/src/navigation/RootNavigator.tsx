import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import SplashScreen from '../screens/SplashScreen';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import LoginScreen from '../screens/LoginScreen';
import PatientRegistrationScreen from '../screens/PatientRegistrationScreen';
import PatientHome from '../screens/PatientHome';
import LanguageSelect from '../screens/LanguageSelect';
import ConditionSelector from '../screens/ConditionSelector';
import CameraScreen from '../screens/CameraScreen';
import ResultScreen from '../screens/ResultScreen';
import AshaHome from '../screens/AshaHome';
import AshaCommissionDashboard from '../screens/AshaCommissionDashboard';
import AshaOfflineQueue from '../screens/AshaOfflineQueue';
import AshaEnrollMonitoring from '../screens/AshaEnrollMonitoring';
import AshaReferralForm from '../screens/AshaReferralForm';
import ConsentScreen from '../screens/ConsentScreen';
import MedicalHistorySetupScreen from '../screens/MedicalHistorySetupScreen';
import ConsultRequestScreen from '../screens/ConsultRequestScreen';
import QueueStatusScreen from '../screens/QueueStatusScreen';
import TeleconsultCompleteScreen from '../screens/TeleconsultCompleteScreen';
import PrescriptionDetailScreen from '../screens/PrescriptionDetailScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import WoundSiteSelector from '../screens/WoundSiteSelector';
import WoundMonitorHome from '../screens/WoundMonitorHome';
import WoundSessionGuide from '../screens/WoundSessionGuide';
import CoinPlacementGuide from '../screens/CoinPlacementGuide';
import PhotoReviewScreen from '../screens/PhotoReviewScreen';
import WoundResultScreen from '../screens/WoundResultScreen';
import WoundHistoryScreen from '../screens/WoundHistoryScreen';
import SkinMonitorHome from '../screens/SkinMonitorHome';
import SkinSessionGuide from '../screens/SkinSessionGuide';
import SkinResultScreen from '../screens/SkinResultScreen';
import ContributingFactorHome from '../screens/ContributingFactorHome';
import PallorCaptureGuide from '../screens/PallorCaptureGuide';
import RedEyeCapture from '../screens/RedEyeCapture';
import ContributingFactorResult from '../screens/ContributingFactorResult';
import SubscriptionManagerScreen from '../screens/SubscriptionManagerScreen';
import PaymentScreen from '../screens/PaymentScreen';
import ProgressReportScreen from '../screens/ProgressReportScreen';
import DataPrivacySettings from '../screens/DataPrivacySettings';
import PatientProfileScreen from '../screens/PatientProfileScreen';
import AshaTrainingHome from '../screens/AshaTrainingHome';
import AshaPatientSearch from '../screens/AshaPatientSearch';
import AshaWoundSiteSetup from '../screens/AshaWoundSiteSetup';
import AshaMonitoringSession from '../screens/AshaMonitoringSession';
import AshaScreeningResult from '../screens/AshaScreeningResult';
import type {TeleconsultPrescription} from '../types/teleconsult';

/** Passed along the screening flow (language → condition → camera → result). */
export type ScreeningFlowContext = {
  sessionRole: 'asha' | 'patient';
  patientId: string;
  patientName: string;
  ashaWorkerPhone?: string;
  followUp: boolean;
  /** Monitoring session from server (when known), auto-filled on teleconsult request. */
  monitoringSessionId?: string;
  /** Alert id when opening consult from alerts flow. */
  alertId?: string;
  submissionMethod?: 'ASHA_ASSISTED' | 'PATIENT_SELF';
  woundSiteId?: string;
  woundSiteLabel?: string;
};

/** Wound module: multi-angle capture from WoundSessionGuide → CameraScreen. */
export type WoundCameraFlowParams = {
  woundSiteId: string;
  woundSiteLabel: string;
  angles: Array<'TOP_DOWN' | 'LEFT_45' | 'RIGHT_45'>;
};

export type RootStackParamList = {
  SplashScreen: undefined;
  RoleSelect: undefined;
  Login: {role: 'asha' | 'patient'};
  PatientRegistration: {
    flow?: 'first_time' | 'patient_edit' | 'asha_new' | 'asha_edit';
    ashaPatientId?: string;
  };
  PatientHome: undefined;
  LanguageSelect:
    | {
        language?: 'en' | 'bn';
        screeningContext?: ScreeningFlowContext;
      }
    | undefined;
  ConditionSelector:
    | {
        language?: 'en' | 'bn';
        screeningContext?: ScreeningFlowContext;
      }
    | undefined;
  CameraScreen:
    | {
        condition?: 'skin' | 'eye' | 'wound';
        language?: 'en' | 'bn';
        screeningContext?: ScreeningFlowContext;
        woundCameraFlow?: WoundCameraFlowParams;
      }
    | undefined;
  ResultScreen:
    | {
        riskLevel?: 'low' | 'medium' | 'high';
        conditions?: string[];
        recommendation?: string | {bn?: string; en?: string};
        screeningContext?: ScreeningFlowContext;
        language?: 'en' | 'bn';
      }
    | undefined;
  ConsultRequest:
    | {
        screeningContext?: ScreeningFlowContext;
        sessionId?: string;
        session_id?: string;
        alertId?: string;
        alert_id?: string;
        language?: 'en' | 'bn';
        riskLevel?: 'low' | 'medium' | 'high';
        conditions?: string[];
        recommendation?: string | {bn?: string; en?: string};
      }
    | undefined;
  QueueStatus: {teleconsultId: string; language?: 'en' | 'bn'};
  TeleconsultComplete: {teleconsultId: string; language?: 'en' | 'bn'};
  PrescriptionDetail: {
    prescription: TeleconsultPrescription;
    language?: 'en' | 'bn';
  };
  NotificationSettings: undefined;
  WoundSiteSelector: undefined;
  WoundMonitorHome: {wound_site_id: string; wound_site_label: string};
  WoundSessionGuide: {
    wound_site_id: string;
    wound_site_label: string;
    language?: 'en' | 'bn';
    screeningContext?: ScreeningFlowContext;
  };
  CoinPlacementGuide: {language?: 'en' | 'bn'} | undefined;
  PhotoReview: {
    wound_site_id: string;
    wound_site_label: string;
    slots: {angle: string; quality: number}[];
    language?: 'en' | 'bn';
    screeningContext?: ScreeningFlowContext;
  };
  AshaScreeningResult: {
    sessionId: string;
    riskLevel: 'low' | 'medium' | 'high';
    primaryFinding: string;
    recommendedAction: string;
    referralRequired: boolean;
    queued?: boolean;
    screeningContext: ScreeningFlowContext;
    language?: 'en' | 'bn';
  };
  WoundResult: {
    session_id: string;
    wound_site_id: string;
    wound_site_label: string;
    alert_level: 'green' | 'amber' | 'red';
    language?: 'en' | 'bn';
  };
  WoundHistory: {wound_site_id: string; wound_site_label: string};
  SkinMonitorHome: undefined;
  SkinSessionGuide: {language?: 'en' | 'bn'} | undefined;
  SkinResult: undefined;
  ContributingFactorHome: undefined;
  PallorCaptureGuide: undefined;
  RedEyeCapture: undefined;
  ContributingFactorResult: undefined;
  SubscriptionManager: undefined;
  PaymentScreen: {
    tier: string;
    amountInr: number;
    tierId?: string;
    action?: 'subscribe' | 'upgrade';
  };
  ProgressReport: {wound_site_id?: string} | undefined;
  DataPrivacySettings: undefined;
  PatientProfile: {initialTab?: 'history' | 'rx' | 'progress' | 'medical'} | undefined;
  AshaHome: undefined;
  AshaCommissionDashboard: undefined;
  AshaOfflineQueue: undefined;
  AshaEnrollMonitoring: {patientId?: string; patientName?: string} | undefined;
  AshaReferralForm: {
    patientId: string;
    patientName: string;
    patientAge?: number;
    village?: string;
    phone?: string;
    riskLevel: 'low' | 'medium' | 'high';
    conditions: string[];
    recommendation?: string;
    diagnosisCode?: string;
    diagnosisDescription?: string;
    specialist?: string;
    urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  };
  MedicalHistorySetup: {onboarding?: boolean};
  Consent: {onboarding?: boolean};
  AshaTrainingHome: undefined;
  AshaPatientSearch: undefined;
  AshaWoundSiteSetup: {
    patientId: string;
    patientName: string;
  };
  AshaMonitoringSession: {
    patientId?: string;
    patientName?: string;
    wound_site_id?: string;
    wound_site_label?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="SplashScreen"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}>
        <Stack.Screen name="SplashScreen" component={SplashScreen} />
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen
          name="PatientRegistration"
          component={PatientRegistrationScreen}
        />
        <Stack.Screen name="PatientHome" component={PatientHome} />
        <Stack.Screen name="LanguageSelect" component={LanguageSelect} />
        <Stack.Screen name="ConditionSelector" component={ConditionSelector} />
        <Stack.Screen name="CameraScreen" component={CameraScreen} />
        <Stack.Screen name="ResultScreen" component={ResultScreen} />
        <Stack.Screen
          name="MedicalHistorySetup"
          component={MedicalHistorySetupScreen}
        />
        <Stack.Screen name="Consent" component={ConsentScreen} />
        <Stack.Screen name="AshaHome" component={AshaHome} />
        <Stack.Screen name="AshaCommissionDashboard" component={AshaCommissionDashboard} />
        <Stack.Screen name="AshaOfflineQueue" component={AshaOfflineQueue} />
        <Stack.Screen name="AshaEnrollMonitoring" component={AshaEnrollMonitoring} />
        <Stack.Screen name="AshaReferralForm" component={AshaReferralForm} />
        <Stack.Screen name="ConsultRequest" component={ConsultRequestScreen} />
        <Stack.Screen name="QueueStatus" component={QueueStatusScreen} />
        <Stack.Screen name="TeleconsultComplete" component={TeleconsultCompleteScreen} />
        <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="WoundSiteSelector" component={WoundSiteSelector} />
        <Stack.Screen name="WoundMonitorHome" component={WoundMonitorHome} />
        <Stack.Screen name="WoundSessionGuide" component={WoundSessionGuide} />
        <Stack.Screen name="CoinPlacementGuide" component={CoinPlacementGuide} />
        <Stack.Screen name="PhotoReview" component={PhotoReviewScreen} />
        <Stack.Screen name="WoundResult" component={WoundResultScreen} />
        <Stack.Screen name="WoundHistory" component={WoundHistoryScreen} />
        <Stack.Screen name="SkinMonitorHome" component={SkinMonitorHome} />
        <Stack.Screen name="SkinSessionGuide" component={SkinSessionGuide} />
        <Stack.Screen name="SkinResult" component={SkinResultScreen} />
        <Stack.Screen name="ContributingFactorHome" component={ContributingFactorHome} />
        <Stack.Screen name="PallorCaptureGuide" component={PallorCaptureGuide} />
        <Stack.Screen name="RedEyeCapture" component={RedEyeCapture} />
        <Stack.Screen name="ContributingFactorResult" component={ContributingFactorResult} />
        <Stack.Screen name="SubscriptionManager" component={SubscriptionManagerScreen} />
        <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
        <Stack.Screen name="ProgressReport" component={ProgressReportScreen} />
        <Stack.Screen name="DataPrivacySettings" component={DataPrivacySettings} />
        <Stack.Screen name="PatientProfile" component={PatientProfileScreen} />
        <Stack.Screen name="AshaTrainingHome" component={AshaTrainingHome} />
        <Stack.Screen name="AshaPatientSearch" component={AshaPatientSearch} />
        <Stack.Screen name="AshaWoundSiteSetup" component={AshaWoundSiteSetup} />
        <Stack.Screen name="AshaMonitoringSession" component={AshaMonitoringSession} />
        <Stack.Screen name="AshaScreeningResult" component={AshaScreeningResult} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
