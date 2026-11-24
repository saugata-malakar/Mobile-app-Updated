import { useEffect, useState } from 'react';
import {
  createSubmission,
  doctorValidateSubmission,
  fetchDoctorValidationQueue,
  fetchMyPayments,
  fetchMySubmissions,
  fetchSubmissionDetail,
  getStoredUser,
  saveClinicalNote,
  submitWorkflowRecord,
  uploadSubmissionPhoto,
  uploadSubmissionReport,
} from '../services/api';
import {
  COMORBIDITY_OPTIONS,
  formatDateTime,
  formatRupees,
  normalizeArray,
  readFileAsBase64,
} from '../utils/workflowUtils';
import {
  CoinProtocolBanner,
  PhotoUploadProtocolGrid,
  PipelineTracker,
  RoleBadge,
  StatusBadge,
  ThreePhotoInspector,
} from '../components/WorkflowShared';

const SEVERITY_OPTIONS = [
  'Mild (Wagner Grade 0-1)',
  'Moderate (Wagner Grade 2)',
  'Severe (Wagner Grade 3)',
  'Critical / Gangrene (Wagner Grade 4-5)',
];

const QUICK_DIAGNOSIS_CHIPS = [
  'Neuropathic plantar ulcer',
  'Ischemic diabetic foot ulcer',
  'Superficial infected abrasion',
  'Healing granulation tissue',
];

export default function DoctorSubmitPortal({ defaultTab = 'collect' }) {
  const user = getStoredUser();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [earnings, setEarnings] = useState({ total_earned: 0, count: 0 });
  const [mySubmissions, setMySubmissions] = useState([]);

  // ── Direct Doctor Submission State ──
  const [isFollowup, setIsFollowup] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientWeight, setPatientWeight] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [district, setDistrict] = useState('Paschim Medinipur');
  const [comorbidities, setComorbidities] = useState(['Type 2 Diabetes']);

  const [submissionId, setSubmissionId] = useState('');
  const [createdPatientId, setCreatedPatientId] = useState('');
  const [photosByNumber, setPhotosByNumber] = useState({});
  const [uploadingMap, setUploadingMap] = useState({});
  const [reports, setReports] = useState([]);
  const [uploadingReport, setUploadingReport] = useState(false);

  const [diagnosis, setDiagnosis] = useState('');
  const [severity, setSeverity] = useState(SEVERITY_OPTIONS[1]);
  const [treatmentNeeded, setTreatmentNeeded] = useState('');
  const [medication, setMedication] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Validate ASHA Queue State ──
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);
  const [valDiagnosis, setValDiagnosis] = useState('');
  const [valSeverity, setValSeverity] = useState(SEVERITY_OPTIONS[1]);
  const [valTreatment, setValTreatment] = useState('');
  const [valMedication, setValMedication] = useState('');
  const [validating, setValidating] = useState(false);
  const [queueFeedback, setQueueFeedback] = useState('');

  const loadDoctorOverview = async () => {
    try {
      const [payRes, subsRes, qRes] = await Promise.all([
        fetchMyPayments(user?.user_id).catch(() => null),
        fetchMySubmissions(user?.user_id).catch(() => []),
        fetchDoctorValidationQueue().catch(() => []),
      ]);
      if (payRes && typeof payRes === 'object') {
        const list = normalizeArray(payRes, ['payments', 'items']);
        const total = payRes.total_earned ?? list.reduce((s, p) => s + Number(p.amount || 0), 0);
        setEarnings({ total_earned: total, count: list.length });
      }
      setMySubmissions(normalizeArray(subsRes, ['submissions', 'items']));
      const qItems = normalizeArray(qRes, ['queue', 'submissions', 'items']);
      setQueue(qItems);
      if (qItems.length > 0 && !selectedQueueItem) {
        selectQueueItem(qItems[0]);
      }
    } catch {
      // ignore
    }
  };

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const qRes = await fetchDoctorValidationQueue();
      const qItems = normalizeArray(qRes, ['queue', 'submissions', 'items']);
      setQueue(qItems);
      if (qItems.length > 0) {
        const keep = qItems.find((i) => i.submission_id === selectedQueueItem?.submission_id) || qItems[0];
        selectQueueItem(keep);
      } else {
        setSelectedQueueItem(null);
      }
    } catch (err) {
      setQueueFeedback(err?.response?.data?.detail || 'Could not load validation queue.');
    } finally {
      setQueueLoading(false);
    }
  };

  const selectQueueItem = async (item) => {
    setSelectedQueueItem(item);
    setValDiagnosis('');
    setValTreatment('');
    setValMedication('');
    try {
      const full = await fetchSubmissionDetail(item.submission_id);
      if (full) {
        setSelectedQueueItem(full.submission ? { ...full.submission, ...full } : full);
      }
    } catch {
      // keep summary
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMyPayments(user?.user_id).catch(() => null),
      fetchMySubmissions(user?.user_id).catch(() => []),
      fetchDoctorValidationQueue().catch(() => []),
    ]).then(([payRes, subsRes, qRes]) => {
      if (cancelled) return;
      if (payRes && typeof payRes === 'object') {
        const list = normalizeArray(payRes, ['payments', 'items']);
        const total = payRes.total_earned ?? list.reduce((s, p) => s + Number(p.amount || 0), 0);
        setEarnings({ total_earned: total, count: list.length });
      }
      setMySubmissions(normalizeArray(subsRes, ['submissions', 'items']));
      const qItems = normalizeArray(qRes, ['queue', 'submissions', 'items']);
      setQueue(qItems);
      if (qItems.length > 0) {
        selectQueueItem(qItems[0]);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleComorbidity = (item) => {
    setComorbidities((prev) => {
      if (item === 'None') return ['None'];
      const cleaned = prev.filter((x) => x !== 'None');
      return cleaned.includes(item) ? cleaned.filter((x) => x !== item) : [...cleaned, item];
    });
  };

  const ensureSubmissionDraft = async () => {
    if (submissionId) return submissionId;
    if (!patientName.trim() || !patientAge || !patientWeight || !bpSystolic || !bpDiastolic || !bloodSugar) {
      throw new Error('Please fill Patient Name, Age, Weight, Blood Pressure, and Blood Sugar first.');
    }
    if (isFollowup && !patientId.trim()) {
      throw new Error('Please enter the existing Patient ID for a 1-month follow-up.');
    }
    const res = await createSubmission({
      patient_name: patientName.trim(),
      patient_age: Number(patientAge),
      patient_weight_kg: Number(patientWeight),
      bp_systolic: Number(bpSystolic),
      bp_diastolic: Number(bpDiastolic),
      blood_sugar: Number(bloodSugar),
      comorbidities,
      district: district.trim(),
      is_followup: isFollowup ? 1 : 0,
      patient_id: isFollowup ? patientId.trim() : undefined,
      submitter_role: 'doctor',
    });
    const sub = res?.submission || res;
    const newId = sub?.submission_id;
    if (!newId) throw new Error('Backend did not return a submission_id.');
    setSubmissionId(newId);
    setCreatedPatientId(sub?.patient_id || '');
    return newId;
  };

  const handleSelectPhoto = async (step, file) => {
    setErrorMsg('');
    setSubmitResult(null);
    setUploadingMap((m) => ({ ...m, [step.number]: true }));
    try {
      const subId = await ensureSubmissionDraft();
      const base64 = await readFileAsBase64(file);
      const uploaded = await uploadSubmissionPhoto(subId, step.number, step.type, base64);
      setPhotosByNumber((prev) => ({
        ...prev,
        [step.number]: {
          ...(uploaded || {}),
          localPreview: base64,
        },
      }));
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Photo upload failed.';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploadingMap((m) => ({ ...m, [step.number]: false }));
    }
  };

  const handleUploadReports = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setErrorMsg('');
    setUploadingReport(true);
    try {
      const subId = await ensureSubmissionDraft();
      for (const f of files) {
        const base64 = await readFileAsBase64(f);
        const res = await uploadSubmissionReport(subId, f.name, f.type || 'application/octet-stream', base64);
        setReports((prev) => [...prev, { file_name: f.name, file_type: f.type, ...(res || {}) }]);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Report upload failed.';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploadingReport(false);
      e.target.value = '';
    }
  };

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitResult(null);

    if (!photosByNumber[1] || !photosByNumber[2] || !photosByNumber[3]) {
      setErrorMsg('Please upload all 3 standardized photos (Distance, Closer, Even Closer) before submitting.');
      return;
    }
    if (!diagnosis.trim()) {
      setErrorMsg('Clinical Note is mandatory for Doctor submissions. Please write a concise diagnosis.');
      return;
    }

    setSubmitting(true);
    try {
      const subId = await ensureSubmissionDraft();
      await saveClinicalNote(subId, {
        diagnosis: diagnosis.trim(),
        severity,
        treatment_needed: treatmentNeeded.trim() || 'Offloading & routine dressing care',
        medication: medication.trim() || 'Continue prescribed glycemic regimen',
      });
      const res = await submitWorkflowRecord(subId);
      const sub = res?.submission || res || {};
      const passed = Boolean(sub.ai_quality_passed ?? res?.ai_quality_passed ?? sub.status === 'accepted');
      setSubmitResult({
        passed,
        status: sub.status || (passed ? 'accepted' : 'rejected'),
        reason: sub.ai_rejection_reason || res?.ai_rejection_reason || '',
        submission_id: subId,
        patient_id: sub.patient_id || createdPatientId,
      });
      await loadDoctorOverview();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Doctor submission failed.';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidateAshaRecord = async (e) => {
    e.preventDefault();
    if (!selectedQueueItem) return;
    if (!valDiagnosis.trim()) {
      setQueueFeedback('Please enter a Diagnosis in the Clinical Note before validating.');
      return;
    }
    setValidating(true);
    setQueueFeedback('');
    try {
      await doctorValidateSubmission(selectedQueueItem.submission_id, {
        diagnosis: valDiagnosis.trim(),
        severity: valSeverity,
        treatment_needed: valTreatment.trim() || 'Wound dressing & offloading',
        medication: valMedication.trim() || 'Continue standard diabetic medication',
      });
      setQueueFeedback(
        `✓ Validated ${selectedQueueItem.submission_id}! Credited ₹30 to Doctor & ₹50 to Field Collector.`
      );
      await loadQueue();
      await loadDoctorOverview();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Validation failed.';
      setQueueFeedback(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setValidating(false);
    }
  };

  const resetDirectForm = () => {
    setSubmissionId('');
    setCreatedPatientId('');
    setPhotosByNumber({});
    setReports([]);
    setSubmitResult(null);
    setErrorMsg('');
    setPatientName('');
    setPatientAge('');
    setPatientWeight('');
    setBpSystolic('');
    setBpDiastolic('');
    setBloodSugar('');
    setPatientId('');
    setDiagnosis('');
    setTreatmentNeeded('');
    setMedication('');
  };

  const uploadedCount = [1, 2, 3].filter((n) => Boolean(photosByNumber[n])).length;

  return (
    <div className="space-y-6 max-w-7xl font-sans">
      {/* Header & Earnings */}
      <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            Doctor Data Collection & Clinical Validation
          </span>
          <h2 className="text-xl font-bold text-white mt-0.5">
            {activeTab === 'collect'
              ? 'Submit Patient Record & Clinical Note (₹80)'
              : 'Validate Moderator-Approved ASHA Records (₹30)'}
          </h2>
          <p className="text-xs text-slate-400">
            Direct collection: ₹80 Doctor + ₹20 Helper = ₹100 · ASHA validation: ₹30 Doctor (₹50 Collector + ₹20 Moderator)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#0C152E] border border-emerald-700/50">
            <span className="block text-[10px] text-slate-400 uppercase font-bold">Doctor Earnings</span>
            <span className="text-lg font-bold text-emerald-400">{formatRupees(earnings.total_earned)}</span>
          </div>

          <div className="inline-flex rounded-xl bg-[#0B132B] p-1 border border-[#23355E]">
            <button
              type="button"
              onClick={() => setActiveTab('collect')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold ${
                activeTab === 'collect' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🩺 New / Follow-up (₹80)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('validate'); loadQueue(); }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                activeTab === 'validate' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>✓ Validate ASHA Queue (₹30)</span>
              {queue.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-[#0B132B] text-[10px] font-black">
                  {queue.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'collect' ? (
        <div className="space-y-6">
          <form onSubmit={handleDoctorSubmit} className="space-y-6">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs font-semibold">
                ⚠ {errorMsg}
              </div>
            )}

            {submitResult && (
              <div
                className={`p-5 rounded-2xl border space-y-2 ${
                  submitResult.passed
                    ? 'bg-emerald-950/35 border-emerald-600/60 text-emerald-100'
                    : 'bg-rose-950/35 border-rose-600/60 text-rose-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    {submitResult.passed
                      ? '✅ Submission Accepted — ₹80 Credited to Doctor (+ ₹20 Helper)!'
                      : '❌ AI Quality Check Rejected — Please Retake & Resubmit'}
                  </h3>
                  <button
                    type="button"
                    onClick={resetDirectForm}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                  >
                    + New Patient Record
                  </button>
                </div>
                <p className="text-xs">
                  Submission ID: <strong className="font-mono">{submitResult.submission_id}</strong> · Patient ID:{' '}
                  <strong className="font-mono">{submitResult.patient_id}</strong>
                </p>
                {!submitResult.passed && (
                  <p className="text-xs text-rose-300">
                    Reason: {submitResult.reason || 'Blurry or incomplete images. No payment issued.'}
                  </p>
                )}
              </div>
            )}

            {/* Step 1: Patient Details */}
            <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Step 1 · Patient Details & Baseline Vitals</h3>
                  <p className="text-[11px] text-slate-400">
                    {submissionId
                      ? `Draft: ${submissionId} · Patient ${createdPatientId}`
                      : 'Enter patient vitals or toggle 1-Month Follow-Up to reuse Patient ID'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#253966] text-xs font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFollowup}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setIsFollowup(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>1-Month Follow-Up Visit</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {isFollowup && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                      Existing Patient ID *
                    </label>
                    <input
                      type="text"
                      value={patientId}
                      disabled={Boolean(submissionId)}
                      onChange={(e) => setPatientId(e.target.value)}
                      placeholder="PAT_KGP_01"
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-amber-600/60 text-xs text-white font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    value={patientName}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Patient Name"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Age (Years) *</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={patientAge}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="58"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={patientWeight}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setPatientWeight(e.target.value)}
                    placeholder="70"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">BP Systolic (mmHg) *</label>
                  <input
                    type="number"
                    value={bpSystolic}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setBpSystolic(e.target.value)}
                    placeholder="130"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">BP Diastolic (mmHg) *</label>
                  <input
                    type="number"
                    value={bpDiastolic}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setBpDiastolic(e.target.value)}
                    placeholder="82"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Blood Sugar (mg/dL) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodSugar}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setBloodSugar(e.target.value)}
                    placeholder="180"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">District</label>
                  <input
                    type="text"
                    value={district}
                    disabled={Boolean(submissionId)}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Comorbidities</label>
                <div className="flex flex-wrap gap-2">
                  {COMORBIDITY_OPTIONS.map((item) => {
                    const selected = comorbidities.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={Boolean(submissionId)}
                        onClick={() => toggleComorbidity(item)}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-[#0C152E] text-slate-300 border-[#253966]'
                        }`}
                      >
                        {selected ? '✓ ' : ''}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 2: 3 System Images */}
            <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Step 2 · Upload 3 Standardized Photos from System ({uploadedCount}/3)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    1. From a distance → 2. Closer → 3. Even closer (coin beside affected area)
                  </p>
                </div>
              </div>

              <CoinProtocolBanner />

              <PhotoUploadProtocolGrid
                photosByNumber={photosByNumber}
                uploadingMap={uploadingMap}
                onSelectFile={handleSelectPhoto}
              />
            </div>

            {/* Step 3: Optional Medical Reports + Mandatory Clinical Note */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-3">
                <h3 className="text-sm font-bold text-white">Step 3 · Previous Medical Reports (Optional)</h3>
                <p className="text-[11px] text-slate-400">
                  Attach prior HbA1c labs, Doppler ultrasound, X-ray, or discharge summaries (PDF, JPG, PNG).
                </p>
                <label className="inline-block cursor-pointer px-4 py-2 rounded-lg bg-[#1A284D] hover:bg-[#23355E] border border-[#2A3F75] text-xs font-bold text-blue-300">
                  {uploadingReport ? 'Uploading Report…' : '+ Add Medical Report File'}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    disabled={uploadingReport}
                    onChange={handleUploadReports}
                    className="hidden"
                  />
                </label>

                {reports.length > 0 && (
                  <ul className="space-y-1.5 pt-2">
                    {reports.map((r, i) => (
                      <li
                        key={`${r.file_name}-${i}`}
                        className="px-3 py-2 rounded-lg bg-[#0C152E] border border-[#23355E] text-xs text-emerald-300 flex items-center justify-between"
                      >
                        <span className="truncate">📄 {r.file_name}</span>
                        <span className="text-[10px] font-bold">Uploaded ✓</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-3">
                <h3 className="text-sm font-bold text-white">Step 4 · Mandatory Clinical Note (1–2 Lines) *</h3>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DIAGNOSIS_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setDiagnosis((d) => (d ? `${d}; ${chip}` : chip))}
                      className="px-2.5 py-1 rounded bg-[#0C152E] hover:bg-[#192952] border border-[#253966] text-[10px] text-blue-300 font-semibold"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Diagnosis *</label>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. Wagner Grade 2 neuropathic plantar ulcer, mild exudate"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Severity *</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                    >
                      {SEVERITY_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Medication</label>
                    <input
                      type="text"
                      value={medication}
                      onChange={(e) => setMedication(e.target.value)}
                      placeholder="e.g. Amoxicillin-Clavulanate 625mg BD"
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Treatment Needed</label>
                    <input
                      type="text"
                      value={treatmentNeeded}
                      onChange={(e) => setTreatmentNeeded(e.target.value)}
                      placeholder="e.g. Sharp debridement, offloading footwear, saline dressing every 48h"
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-2xl bg-[#111C38] border border-[#23355E]">
              <p className="text-xs text-slate-300">
                Runs AI Quality Check immediately: Accepted → <strong className="text-emerald-400">₹80 Doctor + ₹20 Helper</strong> · Rejected → ₹0.
              </p>
              <div className="flex gap-2">
                {submissionId && (
                  <button
                    type="button"
                    onClick={resetDirectForm}
                    className="px-4 py-2.5 rounded-xl bg-[#1A284D] text-slate-200 text-xs font-bold"
                  >
                    Reset Form
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting || uploadedCount < 3}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow disabled:opacity-50"
                >
                  {submitting ? 'Submitting & Running AI Check…' : 'Submit Record & Run AI Check'}
                </button>
              </div>
            </div>
          </form>

          {/* Doctor's Recent Direct Submissions */}
          {mySubmissions.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">My Recent Submissions</h3>
              <div className="space-y-2">
                {mySubmissions.slice(0, 6).map((sub) => (
                  <div
                    key={sub.submission_id}
                    className="p-3 rounded-xl bg-[#0C152E] border border-[#1E2E54] flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{sub.patient_name}</span>
                        <StatusBadge status={sub.status} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {sub.submission_id} · {sub.patient_id} · {formatDateTime(sub.created_at)}
                      </p>
                    </div>
                    <PipelineTracker submission={sub} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Validate ASHA Queue (₹30) */
        <div className="space-y-4">
          {queueFeedback && (
            <div className="p-3.5 rounded-xl bg-blue-950/50 border border-blue-700/50 text-blue-200 text-xs font-semibold">
              {queueFeedback}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Queue List */}
            <div className="lg:col-span-4 rounded-2xl bg-[#111C38] border border-[#23355E] overflow-hidden flex flex-col max-h-[75vh]">
              <div className="p-3.5 border-b border-[#1E2E54] bg-[#0E1736] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Moderator-Approved Queue ({queue.length})
                </span>
                <button
                  type="button"
                  onClick={loadQueue}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300"
                >
                  ↻ Refresh
                </button>
              </div>
              <div className="overflow-y-auto divide-y divide-[#1A284D] flex-1">
                {queueLoading ? (
                  <p className="p-6 text-center text-xs text-slate-400">Loading ASHA queue…</p>
                ) : queue.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No Moderator-approved ASHA records awaiting clinical note right now.
                  </p>
                ) : (
                  queue.map((item) => {
                    const isActive = selectedQueueItem?.submission_id === item.submission_id;
                    return (
                      <button
                        key={item.submission_id}
                        type="button"
                        onClick={() => selectQueueItem(item)}
                        className={`w-full text-left p-3.5 space-y-1 transition-colors ${
                          isActive ? 'bg-[#1B2D5B] border-l-4 border-l-blue-500' : 'hover:bg-[#152246]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate">{item.patient_name}</span>
                          <RoleBadge role={item.submitter_role} workerType={item.worker_type} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.patient_id} · {item.submitted_by_name || item.submitted_by_user_id}
                        </p>
                        <StatusBadge status={item.status} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Clinical Validation Form */}
            <div className="lg:col-span-8 rounded-2xl bg-[#111C38] border border-[#23355E] p-5 space-y-5">
              {!selectedQueueItem ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Select a Moderator-approved ASHA / ICDS / CHO record from the left queue to inspect photos and write your clinical note (+₹30).
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1E2E54] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{selectedQueueItem.patient_name}</h3>
                        <RoleBadge role={selectedQueueItem.submitter_role} workerType={selectedQueueItem.worker_type} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Collector: <strong className="text-slate-200">{selectedQueueItem.submitted_by_name}</strong> · Moderator Note:{' '}
                        <span className="text-violet-300">{selectedQueueItem.moderator_note || 'Approved'}</span>
                      </p>
                    </div>
                    <StatusBadge status={selectedQueueItem.status} />
                  </div>

                  {/* Vitals */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Age / Weight</span>
                      <p className="text-xs font-bold text-white mt-0.5">
                        {selectedQueueItem.patient_age ?? '—'} yrs · {selectedQueueItem.patient_weight_kg ?? '—'} kg
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Blood Pressure</span>
                      <p className="text-xs font-bold text-white mt-0.5">
                        {selectedQueueItem.bp_systolic ?? '—'}/{selectedQueueItem.bp_diastolic ?? '—'} mmHg
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Blood Sugar</span>
                      <p className="text-xs font-bold text-white mt-0.5">{selectedQueueItem.blood_sugar ?? '—'} mg/dL</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Patient ID</span>
                      <p className="text-xs font-bold font-mono text-blue-300 mt-0.5">{selectedQueueItem.patient_id}</p>
                    </div>
                  </div>

                  <ThreePhotoInspector photos={selectedQueueItem.photos || []} />

                  <form onSubmit={handleValidateAshaRecord} className="p-4 rounded-xl bg-[#0C152E] border border-blue-700/40 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      Add Doctor Clinical Note to Complete Record (+₹30 Doctor · +₹50 Collector)
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_DIAGNOSIS_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setValDiagnosis((d) => (d ? `${d}; ${chip}` : chip))}
                          className="px-2 py-0.5 rounded bg-[#142142] border border-[#253966] text-[10px] text-blue-300"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Diagnosis *</label>
                        <input
                          type="text"
                          value={valDiagnosis}
                          onChange={(e) => setValDiagnosis(e.target.value)}
                          placeholder="Clinical diagnosis (1–2 lines)…"
                          required
                          className="w-full px-3 py-2 rounded-lg bg-[#091024] border border-[#253966] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Severity *</label>
                        <select
                          value={valSeverity}
                          onChange={(e) => setValSeverity(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#091024] border border-[#253966] text-xs text-white"
                        >
                          {SEVERITY_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Medication</label>
                        <input
                          type="text"
                          value={valMedication}
                          onChange={(e) => setValMedication(e.target.value)}
                          placeholder="Prescribed medication…"
                          className="w-full px-3 py-2 rounded-lg bg-[#091024] border border-[#253966] text-xs text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Treatment Needed</label>
                        <input
                          type="text"
                          value={valTreatment}
                          onChange={(e) => setValTreatment(e.target.value)}
                          placeholder="Offloading, dressing protocol, referral…"
                          className="w-full px-3 py-2 rounded-lg bg-[#091024] border border-[#253966] text-xs text-white"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={validating}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow disabled:opacity-50"
                    >
                      {validating ? 'Validating…' : '✓ Validate & Complete ASHA Submission (Credit ₹30)'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
