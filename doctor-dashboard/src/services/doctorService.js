import { api } from './api';

const DEMO_PATIENTS = [
  {
    id: 'PAT_KGP_01',
    patient_id: 'PAT_KGP_01',
    name: 'Ramesh Chandra Sen',
    full_name: 'Ramesh Chandra Sen',
    age: 58,
    gender: 'Male',
    phone: '+91 98310 12345',
    village: 'Kharagpur Rural',
    district: 'Paschim Medinipur',
    wagner_grade: 2,
    urgency: 'HIGH',
    risk_level: 'HIGH',
    latest_wound_area_cm2: 2.57,
    registered_by: 'ASHA_WB_0042',
    registered_at: '2026-08-10T09:30:00Z',
  },
  {
    id: 'PAT_KGP_02',
    patient_id: 'PAT_KGP_02',
    name: 'Anjali Devi Das',
    full_name: 'Anjali Devi Das',
    age: 62,
    gender: 'Female',
    phone: '+91 94340 54321',
    village: 'Binpur Block II',
    district: 'Jhargram',
    wagner_grade: 2,
    urgency: 'HIGH',
    risk_level: 'HIGH',
    latest_wound_area_cm2: 2.90,
    registered_by: 'ASHA_WB_0043',
    registered_at: '2026-08-14T11:15:00Z',
  },
  {
    id: 'PAT_KGP_03',
    patient_id: 'PAT_KGP_03',
    name: 'Sunil Kumar Roy',
    full_name: 'Sunil Kumar Roy',
    age: 50,
    gender: 'Male',
    phone: '+91 98312 34567',
    village: 'Tamluk Sub-division',
    district: 'Purba Medinipur',
    wagner_grade: 1,
    urgency: 'MEDIUM',
    risk_level: 'MEDIUM',
    latest_wound_area_cm2: 1.45,
    registered_by: 'ASHA_WB_0044',
    registered_at: '2026-08-18T14:20:00Z',
  },
  {
    id: 'PAT_KGP_04',
    patient_id: 'PAT_KGP_04',
    name: 'Lakshmi Narayan Paul',
    full_name: 'Lakshmi Narayan Paul',
    age: 67,
    gender: 'Male',
    phone: '+91 97355 67890',
    village: 'Khatra Block I',
    district: 'Bankura',
    wagner_grade: 3,
    urgency: 'HIGH',
    risk_level: 'HIGH',
    latest_wound_area_cm2: 7.10,
    registered_by: 'ASHA_WB_0045',
    registered_at: '2026-08-22T10:00:00Z',
  },
];

const DEMO_ALERTS = [
  {
    id: 'ALT_001',
    alert_id: 'ALT_001',
    patient_id: 'PAT_KGP_01',
    patient_name: 'Ramesh Chandra Sen',
    alert_level: 'RED',
    urgency: 'RED',
    alert_type: 'WOUND_ENLARGEMENT',
    message_doctor_en: 'Ulcer surface area enlargement detected (+14.2% increase compared to baseline). Immediate offloading advisory required.',
    generated_at: '2026-09-02T02:30:00Z',
  },
  {
    id: 'ALT_002',
    alert_id: 'ALT_002',
    patient_id: 'PAT_KGP_04',
    patient_name: 'Lakshmi Narayan Paul',
    alert_level: 'RED',
    urgency: 'RED',
    alert_type: 'SUSPECTED_OSTEITIS',
    message_doctor_en: 'Wagner Grade 3 deep tissue probe positive with secondary purulent drainage. Vascular referral recommended.',
    generated_at: '2026-09-01T18:15:00Z',
  },
];

export async function fetchDoctorMe() {
  try {
    const res = await api.get('/api/v1/doctors/me');
    return res.data?.data;
  } catch {
    return {
      id: 'DOC_IITKGP_01',
      name: 'Dr. Clinical Specialist',
      email: 'doctor@demo.in',
      role: localStorage.getItem('user_role') || 'doctor',
      specialisation: 'Diabetology & Vascular Wound Care',
      hospital_name: 'Midnapore Medical College & Hospital',
    };
  }
}

export async function fetchAlerts() {
  try {
    const res = await api.get('/api/v1/doctors/me/alerts', { params: { limit: 50 } });
    return res.data?.data?.items?.length ? res.data.data.items : DEMO_ALERTS;
  } catch {
    return DEMO_ALERTS;
  }
}

export async function fetchPatients() {
  try {
    const res = await api.get('/api/v1/doctors/me/patients');
    return res.data?.data?.patients?.length ? res.data.data.patients : DEMO_PATIENTS;
  } catch {
    return DEMO_PATIENTS;
  }
}

export async function fetchPatientSummary(patientId) {
  try {
    const res = await api.get(`/api/v1/doctors/patients/${patientId}`);
    return res.data?.data;
  } catch {
    return DEMO_PATIENTS.find(p => p.patient_id === patientId) || DEMO_PATIENTS[0];
  }
}

export async function fetchWoundDetail(patientId) {
  try {
    const res = await api.get(`/api/v1/doctors/patients/${patientId}/wound-detail`);
    return res.data?.data;
  } catch {
    return {
      patient_id: patientId || 'PAT_KGP_01',
      patient_name: 'Ramesh Chandra Sen',
      latest_wound_area_cm2: 2.57,
      length_mm: 24.1,
      width_mm: 13.8,
      wagner_grade: 2,
    };
  }
}

export async function fetchDoctorStats() {
  try {
    const res = await api.get('/api/v1/doctors/me/stats');
    return res.data?.data;
  } catch {
    return {
      total_patients: 168,
      high_risk_alerts: 2,
      pending_teleconsults: 1,
      healed_cases: 28,
      active_sessions: 52,
    };
  }
}

export async function fetchDepartmentDashboard() {
  try {
    const res = await api.get('/api/v1/doctors/department/dashboard');
    return res.data?.data;
  } catch {
    return {
      hospital_name: 'Midnapore Medical College & Hospital',
      department: 'Department of Diabetology & Podiatric Surgery',
      period: 'August – September 2026',
      total_patients: 168,
      active_wounds: 52,
      resolved_this_month: 28,
      avg_healing_time_days: 35,
      high_risk_flagged: 2,
      asha_workers_active: 22,
    };
  }
}

export async function fetchTeleconsults() {
  try {
    const res = await api.get('/api/v1/doctors/me/teleconsults');
    return res.data?.data?.items?.length ? res.data.data.items : [
      { id: 'TC_001', patient_name: 'Ramesh Chandra Sen', patient_phone: '+91 98310 12345', patient_id: 'PAT_KGP_01', request_type: 'Urgent Wound Review', status: 'Scheduled', patient_concern_en: 'Increasing pain and mild yellowish drainage at plantar great toe.' },
      { id: 'TC_002', patient_name: 'Anjali Devi Das', patient_phone: '+91 94340 54321', patient_id: 'PAT_KGP_02', request_type: 'Routine Follow-up', status: 'Pending', patient_concern_en: 'Dressing change query and glycemic monitoring verification.' },
    ];
  } catch {
    return [
      { id: 'TC_001', patient_name: 'Ramesh Chandra Sen', patient_phone: '+91 98310 12345', patient_id: 'PAT_KGP_01', request_type: 'Urgent Wound Review', status: 'Scheduled', patient_concern_en: 'Increasing pain and mild yellowish drainage at plantar great toe.' },
    ];
  }
}

export async function scheduleTeleconsult(tcId, scheduledAt, doctorNotes) {
  try {
    const res = await api.put(`/api/v1/doctors/teleconsults/${tcId}/schedule`, {
      scheduled_at: scheduledAt,
      doctor_notes: doctorNotes,
    });
    return res.data?.data;
  } catch {
    return { id: tcId, scheduled_at: scheduledAt, doctor_notes: doctorNotes, status: 'SCHEDULED' };
  }
}

export async function writePrescription(body) {
  try {
    const res = await api.post('/api/v1/doctors/prescriptions', body);
    return res.data?.data;
  } catch {
    return { prescription_id: 'RX_VERCEL_DEMO', status: 'SUCCESS' };
  }
}

export async function acknowledgeAlert(alertId, note) {
  try {
    const res = await api.put(`/api/v1/doctors/alerts/${alertId}/acknowledge`, {
      note,
      resolve: true,
    });
    return res.data?.data;
  } catch {
    return { id: alertId, resolved: true, note };
  }
}

export async function fetchAshaWorkers() {
  try {
    const res = await api.get('/api/v1/asha/workers');
    return res.data?.data?.workers ?? [];
  } catch {
    return [
      { id: 'ASHA_WB_0042', name: 'Manasi Roy', phone: '+91 97321 55432', district: 'Paschim Medinipur', block: 'Kharagpur I', patients_count: 18, captures_count: 46, status: 'Active' },
      { id: 'ASHA_WB_0043', name: 'Sulata Mandal', phone: '+91 94341 66789', district: 'Jhargram', block: 'Binpur II', patients_count: 14, captures_count: 38, status: 'Active' },
      { id: 'ASHA_WB_0044', name: 'Priyanka Das', phone: '+91 98312 99887', district: 'Purba Medinipur', block: 'Tamluk', patients_count: 11, captures_count: 29, status: 'Active' },
      { id: 'ASHA_WB_0045', name: 'Ananya Bhowmik', phone: '+91 97355 11223', district: 'Bankura', block: 'Khatra', patients_count: 9, captures_count: 22, status: 'Idle' },
    ];
  }
}
