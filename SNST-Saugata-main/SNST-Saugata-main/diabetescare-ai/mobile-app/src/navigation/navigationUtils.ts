import {CommonActions, type NavigationProp} from '@react-navigation/native';
import type {RootStackParamList} from './RootNavigator';
import {logout} from '../storage/appStorage';

type RootNav = NavigationProp<RootStackParamList>;

/** Clears the stack to patient home (works when PatientHome is not already in history). */
export function resetToPatientHome(navigation: RootNav) {
  navigation.dispatch(
    CommonActions.reset({index: 0, routes: [{name: 'PatientHome'}]}),
  );
}

/** Clears the stack to ASHA home. */
export function resetToAshaHome(navigation: RootNav) {
  navigation.dispatch(
    CommonActions.reset({index: 0, routes: [{name: 'AshaHome'}]}),
  );
}

/** Signs out and opens the role picker (patient vs ASHA worker). */
export async function logoutToRoleSelect(navigation: RootNav) {
  await logout();
  navigation.dispatch(
    CommonActions.reset({index: 0, routes: [{name: 'RoleSelect'}]}),
  );
}
