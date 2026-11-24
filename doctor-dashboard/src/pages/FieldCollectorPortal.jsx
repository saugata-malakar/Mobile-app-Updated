import { useEffect, useState } from 'react';
import {
  createSubmission,
  fetchMyPayments,
  fetchMySubmissions,
  getStoredUser,
  submitWorkflowRecord,
  uploadSubmissionPhoto,
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
  StatusBadge,
} from '../components/WorkflowShared';

export default function FieldCollectorPortal() {
  const user = getStoredUser();
  const workerLabel = user?.worker_type || localStorage.getItem('worker_type') || 'ASHA';

  const [activeTab, setActiveTab] = useState('collect'); // 'collect' | 'history'
  const [mySubmissions, setMySubmissions] = useState([]);
  const [earnings, setEarnings] = useState({ total_earned: 0, paid: 0, pending: 0 });

  // Patient Details Form
  const [isFollowup, setIsFollowup] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientWeight, setPatientWeight] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [district, setDistrict] = useState(user?.district || 'Paschim Medinipur');
  const [comorbidities, setComorbidities] = useState(['Type 2 Diabetes']);

  // Draft Submission & Photos
  const [submissionId, setSubmissionId] = useState('');
  const [createdPatientId, setCreatedPatientId] = useState('');
  const [photosByNumber, setPhotosByNumber] = useState({});
  const [uploadingMap, setUploadingMap] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadHistoryAndEarnings = async () => {
    try {
      const [subsRes, payRes] = await Promise.all([
        fetchMySubmissions(user?.user_id).catch(() => []),
        fetchMyPayments(user?.user_id).catch(() => null),
      ]);
      setMySubmissions(normalizeArray(subsRes, ['submissions', 'items']));
      if (payRes && typeof payRes === 'object') {
        const list = normalizeArray(payRes, ['payments', 'items']);
        const total = payRes.total_earned ?? list.reduce((s, p) => s + Number(p.amount || 0), 0);
        const paid = payRes.total_paid ?? list.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
        setEarnings({ total_earned: total, paid, pending: total - paid });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMySubmissions(user?.user_id).catch(() => []),
      fetchMyPayments(user?.user_id).catch(() => null),
    ]).then(([subsRes, payRes]) => {
      if (cancelled) return;
      setMySubmissions(normalizeArray(subsRes, ['submissions', 'items']));
      if (payRes && typeof payRes === 'object') {
        const list = normalizeArray(payRes, ['payments', 'items']);
        const total = payRes.total_earned ?? list.reduce((s, p) => s + Number(p.amount || 0), 0);
        const paid = payRes.total_paid ?? list.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
        setEarnings({ total_earned: total, paid, pending: total - paid });
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
      throw new Error('Please fill Patient Name, Age, Weight, Blood Pressure, and Blood Sugar before uploading photos.');
    }
    if (isFollowup && !patientId.trim()) {
      throw new Error('Please enter the existing Patient ID for a 1-month follow-up visit.');
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
      submitter_role: 'field_worker',
      worker_type: workerLabel,
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

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitResult(null);

    if (!photosByNumber[1] || !photosByNumber[2] || !photosByNumber[3]) {
      setErrorMsg('All 3 photos (1. Distance, 2. Closer, 3. Even Closer) must be uploaded before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const subId = await ensureSubmissionDraft();
      const res = await submitWorkflowRecord(subId);
      const sub = res?.submission || res || {};
      setSubmitResult({
        status: sub.status || 'ai_reviewed',
        ai_quality_passed: sub.ai_quality_passed ?? res?.ai_quality_passed ?? true,
        ai_rejection_reason: sub.ai_rejection_reason || res?.ai_rejection_reason || '',
        submission_id: subId,
        patient_id: sub.patient_id || createdPatientId,
      });
      await loadHistoryAndEarnings();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Submission failed.';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmissionId('');
    setCreatedPatientId('');
    setPhotosByNumber({});
    setSubmitResult(null);
    setErrorMsg('');
    setPatientName('');
    setPatientAge('');
    setPatientWeight('');
    setBpSystolic('');
    setBpDiastolic('');
    setBloodSugar('');
    setPatientId('');
  };

  const uploadedCount = [1, 2, 3].filter((n) => Boolean(photosByNumber[n])).length;

  return (
    <div className="space-y-6 max-w-6xl font-sans">
      {/* Header & Earnings */}
      <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700/60 text-[10px] font-bold uppercase">
              {workerLabel} Field Collector
            </span>
            <span className="text-xs text-slate-400">{district}</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            ASHA / ICDS / CHO Data Collection Portal
          </h2>
          <p className="text-xs text-slate-400">
            Welcome, <strong className="text-slate-200">{user?.full_name || 'Field Worker'}</strong> · Earn{' '}
            <strong className="text-emerald-400">₹50</strong> per accepted record (₹50 Collector + ₹20 Moderator + ₹30 Doctor = ₹100)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#0C152E] border border-emerald-700/50">
            <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Earned</span>
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
              + Collect Record
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('history'); loadHistoryAndEarnings(); }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold ${
                activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              My Submissions ({mySubmissions.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'collect' ? (
        <form onSubmit={handleFinalSubmit} className="space-y-6">
          {/* Mandatory Field Collector Warning Banner */}
          <div className="p-4 rounded-xl bg-amber-950/35 border border-amber-600/50 flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="text-xs text-amber-100 space-y-1">
              <p className="font-bold uppercase tracking-wider text-amber-300">
                Field Collector Rule: Do NOT write diagnosis, severity, treatment, or medicine
              </p>
              <p className="text-amber-200/90">
                Your role is to record accurate patient vitals and capture/upload the 3 standardized photos with a coin beside the affected area.
                After AI quality verification and Moderator review, the attending Doctor will write the clinical diagnosis and prescription.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs font-semibold">
              ⚠ {errorMsg}
            </div>
          )}

          {submitResult && (
            <div
              className={`p-5 rounded-2xl border space-y-2 ${
                submitResult.ai_quality_passed
                  ? 'bg-emerald-950/35 border-emerald-600/60 text-emerald-100'
                  : 'bg-rose-950/35 border-rose-600/60 text-rose-100'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">
                  {submitResult.ai_quality_passed
                    ? '✅ AI Quality Check Passed — Sent to Moderator Review!'
                    : '❌ AI Quality Check Rejected — Please Retake & Resubmit'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  + Start Next Patient
                </button>
              </div>
              <p className="text-xs">
                Submission ID: <strong className="font-mono">{submitResult.submission_id}</strong> · Patient ID:{' '}
                <strong className="font-mono">{submitResult.patient_id}</strong>
              </p>
              {submitResult.ai_quality_passed ? (
                <p className="text-xs text-emerald-300">
                  Pipeline: AI Check ✓ → Moderator Review (next) → Doctor Clinical Note → ₹50 credited to your account!
                </p>
              ) : (
                <p className="text-xs text-rose-300">
                  Reason: {submitResult.ai_rejection_reason || 'Blurry or incomplete photos. No payment credited.'}
                </p>
              )}
            </div>
          )}

          {/* Step 1: Patient Details */}
          <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Step 1 · Patient Details & Vitals</h3>
                <p className="text-[11px] text-slate-400">
                  {submissionId
                    ? `Draft Active: ${submissionId} (${createdPatientId || 'Auto-assigned ID'})`
                    : 'Enter patient vitals below before uploading the 3 photos'}
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
                    placeholder="e.g. PAT_KGP_01"
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
                  placeholder="e.g. Ramesh Chandra Sen"
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
                  placeholder="68.5"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">BP Systolic (mmHg) *</label>
                <input
                  type="number"
                  min="50"
                  max="260"
                  value={bpSystolic}
                  disabled={Boolean(submissionId)}
                  onChange={(e) => setBpSystolic(e.target.value)}
                  placeholder="135"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">BP Diastolic (mmHg) *</label>
                <input
                  type="number"
                  min="30"
                  max="160"
                  value={bpDiastolic}
                  disabled={Boolean(submissionId)}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                  placeholder="85"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Blood Sugar (mg/dL) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  value={bloodSugar}
                  disabled={Boolean(submissionId)}
                  onChange={(e) => setBloodSugar(e.target.value)}
                  placeholder="188"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">District / Village</label>
                <input
                  type="text"
                  value={district}
                  disabled={Boolean(submissionId)}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Paschim Medinipur"
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
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-[#0C152E] text-slate-300 border-[#253966] hover:bg-[#162347]'
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
                  Step 2 · Upload 3 Standardized Photos from Your System ({uploadedCount}/3)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Sequence: 1. From a distance → 2. Closer → 3. Even closer (place coin beside affected area)
                </p>
              </div>
              {uploadedCount === 3 && (
                <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-xs font-bold">
                  ✓ All 3 Photos Uploaded
                </span>
              )}
            </div>

            <CoinProtocolBanner />

            <PhotoUploadProtocolGrid
              photosByNumber={photosByNumber}
              uploadingMap={uploadingMap}
              onSelectFile={handleSelectPhoto}
            />
          </div>

          {/* Submit Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-2xl bg-[#111C38] border border-[#23355E]">
            <p className="text-xs text-slate-300">
              Submitting triggers automated AI Quality Check, then queues the record for Moderator review & Doctor validation.
            </p>
            <div className="flex gap-2">
              {submissionId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl bg-[#1A284D] hover:bg-[#23355E] text-slate-200 text-xs font-bold"
                >
                  Clear / New Form
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || uploadedCount < 3}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow disabled:opacity-50"
              >
                {submitting ? 'Running AI Quality Check…' : 'Submit Record for AI & Moderator Review'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* History & Pipeline Tracker Tab */
        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">My Field Submissions & Pipeline Status</h3>
            <button
              type="button"
              onClick={loadHistoryAndEarnings}
              className="px-3 py-1.5 rounded-lg bg-[#1A284D] text-xs font-bold text-slate-200"
            >
              ↻ Refresh
            </button>
          </div>

          {mySubmissions.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">You have not submitted any field records yet.</p>
          ) : (
            <div className="space-y-3">
              {mySubmissions.map((sub) => (
                <div
                  key={sub.submission_id}
                  className="p-4 rounded-xl bg-[#0C152E] border border-[#23355E] flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{sub.patient_name || 'Unnamed Patient'}</span>
                      <StatusBadge status={sub.status} />
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {sub.submission_id} · Patient {sub.patient_id} · {formatDateTime(sub.created_at)}
                    </p>
                    <PipelineTracker submission={sub} />
                    {(sub.ai_rejection_reason || sub.moderator_note) && (
                      <p className="text-[11px] text-slate-300">
                        Note: {sub.ai_rejection_reason || sub.moderator_note}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-400">
                      {sub.status === 'accepted' || sub.status === 'paid' || sub.status === 'doctor_completed'
                        ? '₹50 Credited ✓'
                        : sub.status === 'rejected' || sub.status === 'moderator_rejected'
                        ? '₹0 (Rejected)'
                        : 'Pending ₹50'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
