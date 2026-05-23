import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@hs/patient_onboarding_v1';

export type PatientOnboardingState = {
  profileDone: boolean;
  medicalHistoryDone: boolean;
  consentDone: boolean;
};

const defaultState = (): PatientOnboardingState => ({
  profileDone: false,
  medicalHistoryDone: false,
  consentDone: false,
});

function key(phone: string) {
  return `${KEY}_${phone.replace(/\D/g, '').slice(-10)}`;
}

export async function getPatientOnboarding(phone: string): Promise<PatientOnboardingState> {
  const raw = await AsyncStorage.getItem(key(phone));
  if (!raw) {
    return defaultState();
  }
  try {
    return {...defaultState(), ...(JSON.parse(raw) as PatientOnboardingState)};
  } catch {
    return defaultState();
  }
}

export async function setPatientOnboarding(
  phone: string,
  patch: Partial<PatientOnboardingState>,
) {
  const cur = await getPatientOnboarding(phone);
  await AsyncStorage.setItem(key(phone), JSON.stringify({...cur, ...patch}));
}

export async function isPatientOnboardingComplete(phone: string): Promise<boolean> {
  const s = await getPatientOnboarding(phone);
  return s.profileDone && s.medicalHistoryDone && s.consentDone;
}

export async function markPatientOnboardingComplete(phone: string) {
  await setPatientOnboarding(phone, {
    profileDone: true,
    medicalHistoryDone: true,
    consentDone: true,
  });
}
