import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@hs/asha_training_complete_v1';

function key(phone: string) {
  return `${KEY}_${phone.replace(/\D/g, '').slice(-10)}`;
}

export async function isAshaTrainingComplete(phone: string): Promise<boolean> {
  const v = await AsyncStorage.getItem(key(phone));
  return v === '1';
}

export async function setAshaTrainingComplete(phone: string, complete: boolean) {
  await AsyncStorage.setItem(key(phone), complete ? '1' : '0');
}
