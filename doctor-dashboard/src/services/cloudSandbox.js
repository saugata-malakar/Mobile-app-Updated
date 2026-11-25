// Local browser-persisted clinical workflow store used automatically when the
// website is opened on static hosting (e.g. Vercel) without an external FastAPI backend.

const KEY_USERS = 'dc_sandbox_users_v1';
const KEY_SUBS = 'dc_sandbox_subs_v1';
const KEY_PAYS = 'dc_sandbox_pays_v1';
const KEY_RATES = 'dc_sandbox_rates_v1';

const DEFAULT_RATES = {
  doctor_direct: 80,
  doctor_helper: 20,
  field_worker: 50,
  moderator: 20,
  doctor_validation: 30,
};

const SEEDED_USERS = [
  {
    user_id: 'DOC_IITKGP_01',
    email: 'doctor@demo.in',
    phone: '9831000001',
    username: 'doctor',
    worker_id: 'DOC_IITKGP_01',
    password: 'doctor123',
    full_name: 'Dr. Clinical Specialist',
    role: 'doctor',
    specialization: 'Diabetology & Podiatric Surgery',
    district: 'Paschim Medinipur',
    status: 'active',
    created_at: '2026-10-01T09:00:00.000Z',
  },
  {
    user_id: 'ASHA_WB_0042',
    email: 'asha@demo.in',
    phone: '9831000002',
    username: 'asha001',
    worker_id: 'ASHA_WB_0042',
    password: 'asha123',
    full_name: 'Manasi Roy (ASHA)',
    role: 'field_worker',
    worker_type: 'ASHA',
    district: 'Paschim Medinipur',
    status: 'active',
    created_at: '2026-10-01T09:05:00.000Z',
  },
  {
    user_id: 'ICDS_WB_0010',
    email: 'icds@demo.in',
    phone: '9831000003',
    username: 'icds001',
    worker_id: 'ICDS_WB_0010',
    password: 'icds123',
    full_name: 'ICDS Worker Demo',
    role: 'field_worker',
    worker_type: 'ICDS',
    district: 'Jhargram',
    status: 'active',
    created_at: '2026-10-01T09:10:00.000Z',
  },
  {
    user_id: 'CHO_WB_0015',
    email: 'cho@demo.in',
    phone: '9831000006',
    username: 'cho001',
    worker_id: 'CHO_WB_0015',
    password: 'cho123',
    full_name: 'CHO Officer Demo',
    role: 'field_worker',
    worker_type: 'CHO',
    district: 'Bankura',
    status: 'active',
    created_at: '2026-10-01T09:15:00.000Z',
  },
  {
    user_id: 'MOD_MMCH_01',
    email: 'moderator@demo.in',
    phone: '9831000004',
    username: 'mod001',
    worker_id: 'MOD_MMCH_01',
    password: 'mod123',
    full_name: 'QA Moderator',
    role: 'moderator',
    district: 'Paschim Medinipur',
    status: 'active',
    created_at: '2026-10-01T09:20:00.000Z',
  },
  {
    user_id: 'ADMIN_MMCH_01',
    email: 'admin@hospital.in',
    phone: '9831000005',
    username: 'admin',
    worker_id: 'ADMIN_MMCH_01',
    password: 'admin123',
    full_name: 'System Admin',
    role: 'admin',
    district: 'Paschim Medinipur',
    status: 'active',
    created_at: '2026-10-01T09:25:00.000Z',
  },
  {
    user_id: 'PAT_KGP_01',
    email: 'patient@demo.in',
    phone: '9831000007',
    username: 'patient',
    worker_id: 'PAT_KGP_01',
    password: 'patient123',
    full_name: 'Ramesh Chandra Sen',
    role: 'patient',
    district: 'Paschim Medinipur',
    status: 'active',
    created_at: '2026-10-01T09:30:00.000Z',
  },
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage quota errors on huge base64 strings
  }
}

function getUsers() {
  const existing = readJson(KEY_USERS, null);
  if (Array.isArray(existing) && existing.length > 0) return existing;
  writeJson(KEY_USERS, SEEDED_USERS);
  return [...SEEDED_USERS];
}

function getSubs() {
  return readJson(KEY_SUBS, []);
}

function getPays() {
  return readJson(KEY_PAYS, []);
}

function getRates() {
  return { ...DEFAULT_RATES, ...readJson(KEY_RATES, DEFAULT_RATES) };
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function currentSessionUser() {
  try {
    const raw = localStorage.getItem('user_profile');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    user_id: localStorage.getItem('user_id') || 'DOC_IITKGP_01',
    role: localStorage.getItem('user_role') || 'doctor',
    full_name: localStorage.getItem('user_name') || 'Clinical User',
    worker_type: localStorage.getItem('worker_type') || '',
  };
}

function sanitizeUser(u) {
  if (!u) return null;
  const copy = { ...u };
  delete copy.password;
  return copy;
}

function addPayment(submissionId, userId, userName, role, amount, description) {
  const pays = getPays();
  const exists = pays.some(
    (p) => p.submission_id === submissionId && p.role === role && p.description === description
  );
  if (exists) return;
  pays.unshift({
    payment_id: uid('PAY'),
    submission_id: submissionId,
    user_id: userId,
    user_name: userName,
    role,
    amount: Number(amount),
    description,
    status: 'credited',
    created_at: new Date().toISOString(),
    paid_at: null,
  });
  writeJson(KEY_PAYS, pays);
}

export function sandboxRegister(payload) {
  const users = getUsers();
  const email = (payload.email || '').trim().toLowerCase();
  const phone = (payload.phone || '').trim();
  const username = (payload.username || '').trim().toLowerCase();
  const workerId = (payload.worker_id || '').trim().toUpperCase();

  const dup = users.find(
    (u) =>
      (email && (u.email || '').toLowerCase() === email) ||
      (phone && (u.phone || '') === phone) ||
      (username && (u.username || '').toLowerCase() === username) ||
      (workerId && (u.worker_id || '').toUpperCase() === workerId)
  );
  if (dup) {
    throw new Error('An account with that email, phone, username, or worker ID already exists.');
  }

  const role = (payload.role || 'field_worker').toLowerCase();
  const prefix =
    role === 'doctor' ? 'DOC' : role === 'moderator' ? 'MOD' : role === 'admin' ? 'ADM' : role === 'patient' ? 'PAT' : 'FW';
  const newUser = {
    user_id: uid(prefix),
    email: payload.email?.trim() || '',
    phone: payload.phone?.trim() || '',
    username: payload.username?.trim() || '',
    worker_id: payload.worker_id?.trim() || uid(prefix),
    password: payload.password || '123456',
    full_name: payload.full_name?.trim() || 'New User',
    role,
    worker_type: role === 'field_worker' ? payload.worker_type || 'ASHA' : '',
    district: payload.district?.trim() || 'Paschim Medinipur',
    specialization: payload.specialization?.trim() || '',
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  users.unshift(newUser);
  writeJson(KEY_USERS, users);

  const safe = sanitizeUser(newUser);
  return {
    pending_approval: true,
    status: 'pending',
    role: safe.role,
    user_id: safe.user_id,
    name: safe.full_name,
    user: safe,
    message: 'Registration submitted. An Administrator must verify and approve your account before login.',
    sandbox_mode: true,
  };
}

export function sandboxLogin(identifier, password) {
  const users = getUsers();
  const idClean = String(identifier || '').trim().toLowerCase();
  const match = users.find(
    (u) =>
      (u.email || '').toLowerCase() === idClean ||
      (u.phone || '').toLowerCase() === idClean ||
      (u.username || '').toLowerCase() === idClean ||
      (u.worker_id || '').toLowerCase() === idClean
  );

  if (!match || match.password !== password) {
    throw new Error('Invalid identifier or password.');
  }
  if (match.status === 'pending') {
    throw new Error('Account is pending Admin verification. An Administrator must approve your account before you can sign in.');
  }
  if (match.status === 'rejected') {
    throw new Error('Your account registration was rejected by the Administrator.');
  }
  if (match.status === 'suspended') {
    throw new Error('Account is suspended by Administrator.');
  }

  const safe = sanitizeUser(match);
  return {
    token: `sandbox_jwt_${match.user_id}`,
    refresh_token: `sandbox_ref_${match.user_id}`,
    role: safe.role,
    user_id: safe.user_id,
    name: safe.full_name,
    user: safe,
    sandbox_mode: true,
  };
}

export function sandboxCreateSubmission(payload) {
  const cu = currentSessionUser();
  const subs = getSubs();
  const now = new Date().toISOString();
  const sub = {
    submission_id: uid('SUB'),
    patient_id: payload.patient_id?.trim() || uid('PAT_KGP'),
    submitted_by_user_id: payload.submitted_by_user_id || cu.user_id,
    submitted_by_name: payload.submitted_by_name || cu.full_name,
    submitter_role: payload.submitter_role || cu.role || 'field_worker',
    worker_type: payload.worker_type || cu.worker_type || '',
    status: 'draft',
    is_followup: payload.is_followup ? 1 : 0,
    patient_name: payload.patient_name || 'Patient',
    patient_age: payload.patient_age,
    patient_weight_kg: payload.patient_weight_kg,
    bp_systolic: payload.bp_systolic ?? payload.patient_bp_systolic,
    bp_diastolic: payload.bp_diastolic ?? payload.patient_bp_diastolic,
    blood_sugar: payload.blood_sugar ?? payload.patient_blood_sugar,
    comorbidities: payload.comorbidities ?? payload.patient_comorbidities ?? [],
    district: payload.district || 'Paschim Medinipur',
    photos: [],
    reports: [],
    created_at: now,
    updated_at: now,
  };
  subs.unshift(sub);
  writeJson(KEY_SUBS, subs);
  return { submission: sub, ...sub };
}

export function sandboxUploadPhoto(subId, photoNumber, photoType, base64Data) {
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  const dataUri = base64Data?.startsWith('data:')
    ? base64Data
    : `data:image/jpeg;base64,${base64Data}`;
  const photo = {
    photo_id: uid('PHT'),
    submission_id: subId,
    photo_number: Number(photoNumber),
    photo_type: photoType || (photoNumber === 1 ? 'distant' : photoNumber === 2 ? 'medium' : 'close'),
    file_url: dataUri,
    annotated_url: dataUri,
    quality_passed: true,
    blur_score: 148.5,
    brightness_mean: 136.0,
    coin_detected: true,
    created_at: new Date().toISOString(),
  };
  sub.photos = (sub.photos || []).filter((p) => p.photo_number !== Number(photoNumber));
  sub.photos.push(photo);
  sub.photos.sort((a, b) => a.photo_number - b.photo_number);
  sub.ai_wagner_grade = 2;
  sub.ai_area_cm2 = 2.45;
  sub.updated_at = new Date().toISOString();
  writeJson(KEY_SUBS, subs);
  return photo;
}

export function sandboxUploadReport(subId, fileName, fileType, base64Data) {
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  const dataUri = base64Data?.startsWith('data:')
    ? base64Data
    : `data:${fileType || 'application/octet-stream'};base64,${base64Data}`;
  const rep = {
    report_id: uid('RPT'),
    submission_id: subId,
    file_name: fileName,
    file_type: fileType,
    file_url: dataUri,
    created_at: new Date().toISOString(),
  };
  sub.reports = sub.reports || [];
  sub.reports.push(rep);
  writeJson(KEY_SUBS, subs);
  return rep;
}

export function sandboxSaveClinicalNote(subId, notePayload) {
  const cu = currentSessionUser();
  if (cu.role === 'field_worker') {
    throw new Error('Field collectors cannot write clinical notes.');
  }
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  sub.doctor_id = cu.user_id;
  sub.doctor_name = cu.full_name;
  sub.diagnosis = notePayload.diagnosis;
  sub.severity = notePayload.severity;
  sub.treatment_needed = notePayload.treatment_needed;
  sub.medication = notePayload.medication;
  sub.updated_at = new Date().toISOString();
  writeJson(KEY_SUBS, subs);
  return sub;
}

export function sandboxSubmitRecord(subId) {
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  if ((sub.photos || []).length < 3) {
    sub.status = 'rejected';
    sub.ai_quality_passed = false;
    sub.ai_rejection_reason = 'All 3 photos (Distance, Closer, Even Closer) are required.';
    writeJson(KEY_SUBS, subs);
    return sub;
  }
  const rates = getRates();
  const now = new Date().toISOString();
  sub.ai_quality_passed = true;
  sub.ai_quality_score = 0.91;
  sub.updated_at = now;

  if (sub.submitter_role === 'doctor') {
    if (!sub.diagnosis?.trim()) {
      throw new Error('Clinical note (diagnosis) is required before submitting as a doctor.');
    }
    sub.status = 'accepted';
    sub.doctor_completed_at = now;
    addPayment(subId, sub.submitted_by_user_id, sub.submitted_by_name, 'doctor', rates.doctor_direct, 'Doctor Direct Submission Accepted');
    addPayment(subId, 'HELPER_TEAM', 'Clinic Helper / Assistant', 'helper', rates.doctor_helper, 'Assistant/Helper Share');
  } else {
    sub.status = 'ai_reviewed';
  }
  writeJson(KEY_SUBS, subs);
  return sub;
}

export function sandboxMySubmissions(userId) {
  const cu = currentSessionUser();
  const id = userId || cu.user_id;
  return { submissions: getSubs().filter((s) => s.submitted_by_user_id === id) };
}

export function sandboxGetSubmission(subId) {
  return getSubs().find((s) => s.submission_id === subId) || null;
}

export function sandboxModeratorQueue(status = 'ai_reviewed') {
  const subs = getSubs().filter((s) => s.submitter_role === 'field_worker');
  if (!status || status === 'all') {
    return { queue: subs.filter((s) => ['ai_reviewed', 'moderator_approved', 'moderator_rejected', 'accepted'].includes(s.status)) };
  }
  return { queue: subs.filter((s) => s.status === status) };
}

export function sandboxModeratorApprove(subId, note) {
  const cu = currentSessionUser();
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  sub.status = 'moderator_approved';
  sub.moderator_id = cu.user_id;
  sub.moderator_name = cu.full_name;
  sub.moderator_decision = 'approved';
  sub.moderator_note = note || 'Approved by moderator';
  sub.moderator_reviewed_at = new Date().toISOString();
  writeJson(KEY_SUBS, subs);
  addPayment(subId, cu.user_id, cu.full_name, 'moderator', getRates().moderator, 'Moderator Verification');
  return sub;
}

export function sandboxModeratorReject(subId, reason) {
  const cu = currentSessionUser();
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  sub.status = 'moderator_rejected';
  sub.moderator_id = cu.user_id;
  sub.moderator_name = cu.full_name;
  sub.moderator_decision = 'rejected';
  sub.moderator_note = reason;
  sub.moderator_reviewed_at = new Date().toISOString();
  writeJson(KEY_SUBS, subs);
  return sub;
}

export function sandboxDoctorQueue() {
  return { queue: getSubs().filter((s) => s.status === 'moderator_approved' && s.submitter_role === 'field_worker') };
}

export function sandboxDoctorValidate(subId, notePayload) {
  const cu = currentSessionUser();
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  sub.status = 'accepted';
  sub.doctor_id = cu.user_id;
  sub.doctor_name = cu.full_name;
  sub.diagnosis = notePayload.diagnosis;
  sub.severity = notePayload.severity;
  sub.treatment_needed = notePayload.treatment_needed;
  sub.medication = notePayload.medication;
  sub.doctor_completed_at = new Date().toISOString();
  writeJson(KEY_SUBS, subs);
  const rates = getRates();
  addPayment(subId, sub.submitted_by_user_id, sub.submitted_by_name, 'field_worker', rates.field_worker, 'Field Collector Record Accepted');
  addPayment(subId, cu.user_id, cu.full_name, 'doctor', rates.doctor_validation, 'Doctor Clinical Note & Validation');
  return sub;
}

export function sandboxMyPayments(userId) {
  const cu = currentSessionUser();
  const id = userId || cu.user_id;
  const rows = getPays().filter((p) => p.user_id === id);
  const total_earned = rows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const total_paid = rows.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  return { payments: rows, total_earned, total_paid, total_credited: total_earned - total_paid };
}

export function sandboxAdminStats() {
  const users = getUsers();
  const subs = getSubs();
  const pays = getPays();
  const users_by_role = {};
  users.forEach((u) => {
    users_by_role[u.role] = (users_by_role[u.role] || 0) + 1;
  });
  const subs_by_status = {};
  subs.forEach((s) => {
    subs_by_status[s.status] = (subs_by_status[s.status] || 0) + 1;
  });
  const today = new Date().toISOString().slice(0, 10);
  const today_submissions = subs.filter((s) => String(s.created_at || '').startsWith(today)).length;
  const payouts_by_role = {};
  pays.forEach((p) => {
    payouts_by_role[p.role] = (payouts_by_role[p.role] || 0) + Number(p.amount || 0);
  });
  return {
    total_users: users.length,
    users_by_role,
    pending_users: users.filter((u) => u.status === 'pending').length,
    total_submissions: subs.length,
    today_submissions,
    pending_moderator: subs_by_status.ai_reviewed || 0,
    pending_doctor: subs_by_status.moderator_approved || 0,
    accepted_count: subs_by_status.accepted || 0,
    rejected_count: (subs_by_status.rejected || 0) + (subs_by_status.moderator_rejected || 0),
    submissions_by_status: subs_by_status,
    total_payouts: pays.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    payouts_by_role,
  };
}

export function sandboxAdminUsers(role, search, statusFilter) {
  let list = getUsers().map(sanitizeUser);
  if (role && role !== 'ALL') {
    list = list.filter((u) => String(u.role).toLowerCase() === String(role).toLowerCase());
  }
  if (statusFilter && statusFilter !== 'ALL') {
    list = list.filter((u) => String(u.status).toLowerCase() === String(statusFilter).toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((u) =>
      [u.full_name, u.email, u.phone, u.username, u.worker_id, u.district]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }
  list.sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1));
  return { users: list };
}

export function sandboxAdminUpdateUser(userId, payload) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.user_id === userId);
  if (idx < 0) throw new Error('User not found');
  users[idx] = { ...users[idx], ...payload };
  writeJson(KEY_USERS, users);
  return { user: sanitizeUser(users[idx]) };
}

export function sandboxAdminSubmissions(filters = {}) {
  let list = getSubs();
  if (filters.status && filters.status !== 'ALL') {
    list = list.filter((s) => s.status === filters.status);
  }
  if (filters.role && filters.role !== 'ALL') {
    list = list.filter((s) => s.submitter_role === filters.role);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((s) =>
      [s.patient_id, s.patient_name, s.submitted_by_name]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }
  return { submissions: list };
}

export function sandboxAdminOverride(subId, decision, reason) {
  const subs = getSubs();
  const sub = subs.find((s) => s.submission_id === subId);
  if (!sub) throw new Error('Submission not found');
  sub.status = decision;
  sub.moderator_note = reason || sub.moderator_note;
  if (decision === 'rejected') sub.ai_rejection_reason = reason;
  writeJson(KEY_SUBS, subs);
  if (decision === 'accepted') {
    const rates = getRates();
    if (sub.submitter_role === 'doctor') {
      addPayment(subId, sub.submitted_by_user_id, sub.submitted_by_name, 'doctor', rates.doctor_direct, 'Admin Override Accepted (Doctor)');
    } else {
      addPayment(subId, sub.submitted_by_user_id, sub.submitted_by_name, 'field_worker', rates.field_worker, 'Admin Override Accepted (Collector)');
    }
  }
  return sub;
}

export function sandboxAdminPayments(filters = {}) {
  let list = getPays();
  if (filters.role && filters.role !== 'ALL') {
    list = list.filter((p) => p.role === filters.role);
  }
  if (filters.status && filters.status !== 'ALL') {
    list = list.filter((p) => p.status === filters.status);
  }
  return { payments: list, total_amount: list.reduce((s, p) => s + Number(p.amount || 0), 0) };
}

export function sandboxAdminMarkPaid(paymentId) {
  const pays = getPays();
  const p = pays.find((x) => x.payment_id === paymentId);
  if (!p) throw new Error('Payment not found');
  p.status = 'paid';
  p.paid_at = new Date().toISOString();
  writeJson(KEY_PAYS, pays);
  return { payment: p };
}

export function sandboxGetRates() {
  return { rates: getRates() };
}

export function sandboxUpdateRates(ratesPayload) {
  const next = { ...getRates(), ...ratesPayload };
  writeJson(KEY_RATES, next);
  return { rates: next };
}
