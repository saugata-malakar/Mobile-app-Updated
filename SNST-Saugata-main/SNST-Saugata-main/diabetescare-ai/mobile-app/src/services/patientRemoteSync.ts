import type {PatientProfile} from '../types/app';
import {API_BASE_URL} from '../config/api';

/**
 * Best-effort sync after ASHA saves a patient locally. Does not throw.
 * Uses fetch (not axios) so no auth refresh / interceptors run and nothing surfaces on the UI.
 */
export async function trySyncAshaPatientToServer(profile: PatientProfile): Promise<void> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`${API_BASE_URL}/api/v1/asha/patients`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        full_name: profile.fullName,
        age: profile.age,
        gender: profile.gender || undefined,
        phone_number: profile.phone,
        address: profile.address,
        village: profile.village,
        emergency_contact: profile.emergencyContact,
        blood_group: profile.bloodGroup,
        allergies: profile.allergies,
        chronic_conditions: profile.chronicConditions,
        client_patient_id: profile.id,
      }),
      signal: controller.signal,
    });
  } catch {
    // Offline, wrong host, or endpoint missing — local roster stays authoritative.
  } finally {
    clearTimeout(t);
  }
}
