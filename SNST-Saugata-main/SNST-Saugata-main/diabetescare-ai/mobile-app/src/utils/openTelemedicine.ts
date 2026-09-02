import {Alert, Linking} from 'react-native';
import {TELEMEDICINE_PORTAL_URL} from '../config/telemedicine';

export const SCREENING_DISCLAIMER =
  'AI-assisted screening only. Not a medical diagnosis.';

export async function requestTelemedicineConsultation() {
  const url = TELEMEDICINE_PORTAL_URL?.trim();
  if (!url) {
    Alert.alert(
      'Doctor consultation (telemedicine)',
      'You can request a video or phone consultation with a doctor through our telemedicine portal when you need it.\n\n' +
        'The portal link will be enabled in a future app update. For urgent care, contact your nearest clinic or emergency services.',
      [{text: 'OK'}],
    );
    return;
  }
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Unable to open link', 'Please try again later.');
    }
  } catch {
    Alert.alert('Unable to open link', 'Please try again later.');
  }
}
