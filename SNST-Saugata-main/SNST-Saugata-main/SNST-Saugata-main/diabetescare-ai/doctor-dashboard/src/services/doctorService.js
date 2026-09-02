import { api } from './api';

export async function fetchDoctorMe() {
  const res = await api.get('/api/v1/doctors/me');
  return res.data?.data;
}

export async function fetchAlerts(resolved = false) {
  const res = await api.get('/api/v1/doctors/me/alerts', {
    params: { resolved: resolved ? 'true' : 'false', limit: 50 },
  });
  return res.data?.data?.items ?? [];
}

export async function fetchPatients() {
  const res = await api.get('/api/v1/doctors/me/patients');
  return res.data?.data?.patients ?? [];
}

export async function fetchPatientSummary(patientId) {
  const res = await api.get(`/api/v1/doctors/patients/${patientId}`);
  return res.data?.data;
}

export async function fetchWoundDetail(patientId, woundSiteId) {
  const res = await api.get(`/api/v1/doctors/patients/${patientId}/wound-detail`, {
    params: woundSiteId ? { wound_site_id: woundSiteId } : {},
  });
  return res.data?.data;
}

export async function acknowledgeAlert(alertId, note) {
  const res = await api.put(`/api/v1/doctors/alerts/${alertId}/acknowledge`, {
    note,
    resolve: true,
  });
  return res.data?.data;
}

export async function fetchTeleconsults() {
  const res = await api.get('/api/v1/doctors/me/teleconsults');
  return res.data?.data?.items ?? [];
}

export async function scheduleTeleconsult(tcId, scheduledAt, doctorNotes) {
  const res = await api.put(`/api/v1/doctors/teleconsults/${tcId}/schedule`, {
    scheduled_at: scheduledAt,
    doctor_notes: doctorNotes,
  });
  return res.data?.data;
}

export async function writePrescription(body) {
  const res = await api.post('/api/v1/doctors/prescriptions', body);
  return res.data?.data;
}

export async function fetchDepartmentDashboard() {
  const res = await api.get('/api/v1/doctors/department/dashboard');
  return res.data?.data;
}

export async function fetchDoctorStats() {
  const res = await api.get('/api/v1/doctors/me/stats');
  return res.data?.data;
}
