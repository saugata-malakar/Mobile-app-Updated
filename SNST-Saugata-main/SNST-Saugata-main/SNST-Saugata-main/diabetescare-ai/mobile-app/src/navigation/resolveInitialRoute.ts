import type {RootStackParamList} from './RootNavigator';
import {getPatientSelfProfile, getSession} from '../storage/appStorage';
import {
  getPatientOnboarding,
  isPatientOnboardingComplete,
  setPatientOnboarding,
} from '../storage/onboardingStorage';
import {isAshaTrainingComplete} from '../storage/ashaTrainingStorage';

export type InitialRoute =
  | {name: 'RoleSelect'}
  | {name: 'PatientHome'}
  | {name: 'MedicalHistorySetup'; params?: RootStackParamList['MedicalHistorySetup']}
  | {name: 'Consent'; params?: RootStackParamList['Consent']}
  | {name: 'PatientRegistration'; params: RootStackParamList['PatientRegistration']}
  | {name: 'AshaHome'}
  | {name: 'AshaTrainingHome'};

/** Maps Apps.pdf P1 splash routing. */
export async function resolveInitialRoute(): Promise<InitialRoute> {
  const session = await getSession();
  if (!session) {
    return {name: 'RoleSelect'};
  }

  if (session.role === 'patient') {
    const profile = await getPatientSelfProfile(session.phone);
    if (!profile) {
      return {name: 'PatientRegistration', params: {flow: 'first_time'}};
    }
    const onboard = await getPatientOnboarding(session.phone);
    if (!onboard.profileDone) {
      await setPatientOnboarding(session.phone, {profileDone: true});
    }
    if (!(await isPatientOnboardingComplete(session.phone))) {
      if (!onboard.medicalHistoryDone) {
        return {name: 'MedicalHistorySetup', params: {onboarding: true}};
      }
      if (!onboard.consentDone) {
        return {name: 'Consent', params: {onboarding: true}};
      }
      return {name: 'PatientRegistration', params: {flow: 'patient_edit'}};
    }
    return {name: 'PatientHome'};
  }

  if (session.role === 'asha') {
    const trained = await isAshaTrainingComplete(session.phone);
    return trained ? {name: 'AshaHome'} : {name: 'AshaTrainingHome'};
  }

  return {name: 'RoleSelect'};
}
