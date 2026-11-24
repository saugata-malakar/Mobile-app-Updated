import { useEffect, useState } from 'react';
import {
  fetchAdminSubmissions,
  fetchSubmissionDetail,
  overrideAdminSubmission,
  resolveAssetUrl,
} from '../services/api';
import {
  formatDateTime,
  normalizeArray,
} from '../utils/workflowUtils';
import {
  PipelineTracker,
  RoleBadge,
  StatusBadge,
  ThreePhotoInspector,
} from '../components/WorkflowShared';

const STATUS_OPTIONS = [
  'ALL',
  'draft',
  'submitted',
  'ai_reviewed',
  'moderator_approved',
  'moderator_rejected',
  'accepted',
  'doctor_completed',
  'rejected',
];

const ROLE_OPTIONS = ['ALL', 'doctor', 'field_worker'];

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetchAdminSubmissions({
        status: statusFilter,
        role: roleFilter,
        search: search.trim() || undefined,
      });
      setSubmissions(normalizeArray(res, ['submissions', 'items']));
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchAdminSubmissions({
      status: statusFilter,
      role: roleFilter,
      search: search.trim() || undefined,
    })
      .then((res) => {
        if (!cancelled) setSubmissions(normalizeArray(res, ['submissions', 'items']));
      })
      .catch((err) => {
        if (!cancelled) setFeedback(err?.response?.data?.detail || 'Failed to load submissions.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, roleFilter]);

  const openInspector = async (sub) => {
    setSelected(sub);
    setOverrideReason('');
    setDetailLoading(true);
    try {
      const full = await fetchSubmissionDetail(sub.submission_id);
      if (full) {
        setSelected(full.submission ? { ...full.submission, ...full } : full);
      }
    } catch {
      // keep summary record if detail endpoint is unavailable
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOverride = async (decision) => {
    if (!selected) return;
    if (!overrideReason.trim()) {
      setFeedback('Please enter an administrative override reason before applying Force Accept / Force Reject.');
      return;
    }
    setOverrideBusy(true);
    setFeedback('');
    try {
      const updated = await overrideAdminSubmission(selected.submission_id, decision, overrideReason.trim());
      setFeedback(`Submission ${selected.submission_id} overridden to "${decision}".`);
      setSelected((prev) => ({
        ...prev,
        ...(updated?.submission || updated || {}),
        status: decision,
      }));
      await loadSubmissions();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Override failed.');
    } finally {
      setOverrideBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl font-sans">
      <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Admin · Clinical QA & Oversight</span>
          <h2 className="text-xl font-bold text-white mt-0.5">All Submissions & Photo Inspector</h2>
          <p className="text-xs text-slate-400">
            Click any submission row to inspect patient vitals, 3 uploaded photos (+ AI overlays), reports, clinical notes, and override decisions.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadSubmissions();
          }}
          className="flex flex-wrap gap-2"
        >
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === 'ALL' ? 'All Submitter Roles' : r === 'doctor' ? 'Doctor Only' : 'ASHA / ICDS / CHO'}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st === 'ALL' ? 'All Statuses' : st}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient ID / Name / Sub ID…"
            className="px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white placeholder-slate-500"
          />

          <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
            Filter
          </button>
        </form>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-700/50 text-blue-200 text-xs font-semibold">
          {feedback}
        </div>
      )}

      <div className="rounded-2xl bg-[#111C38] border border-[#23355E] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading submissions…</div>
        ) : submissions.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No submissions match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1736] text-[10px] uppercase text-slate-400 border-b border-[#23355E]">
                <tr>
                  <th className="py-3 px-4">Submission / Patient</th>
                  <th className="py-3 px-4">Submitter</th>
                  <th className="py-3 px-4">Vitals Summary</th>
                  <th className="py-3 px-4">AI Check</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A284D]">
                {submissions.map((sub) => (
                  <tr
                    key={sub.submission_id}
                    onClick={() => openInspector(sub)}
                    className="hover:bg-[#17264D] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">{sub.patient_name || 'Unnamed Patient'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {sub.submission_id} · {sub.patient_id}
                        {sub.is_followup ? ' (Follow-up)' : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-200 font-medium">{sub.submitted_by_name || sub.submitted_by_user_id}</p>
                      <RoleBadge role={sub.submitter_role} workerType={sub.worker_type} />
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-[11px]">
                      Age {sub.patient_age ?? '—'} · BP {sub.bp_systolic ?? '—'}/{sub.bp_diastolic ?? '—'} · Sugar {sub.blood_sugar ?? '—'} mg/dL
                    </td>
                    <td className="py-3 px-4">
                      {sub.ai_quality_passed === 1 || sub.ai_quality_passed === true ? (
                        <span className="text-emerald-400 font-bold">✓ Passed</span>
                      ) : sub.ai_quality_passed === 0 || sub.ai_quality_passed === false ? (
                        <span className="text-rose-400 font-bold">✕ Failed</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-400">
                      {formatDateTime(sub.updated_at || sub.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-600/40 font-bold text-[11px]">
                        Open →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rich Inspector Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[#111C38] border border-[#253966] rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1E2E54] pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-white">{selected.patient_name || 'Patient Record'}</h3>
                  <StatusBadge status={selected.status} />
                  <RoleBadge role={selected.submitter_role} workerType={selected.worker_type} />
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Submission: {selected.submission_id} · Patient ID: {selected.patient_id} · Collector: {selected.submitted_by_name || selected.submitted_by_user_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-3 py-1.5 rounded-lg bg-[#1D2B52] hover:bg-[#253966] text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <PipelineTracker submission={selected} />

            {detailLoading && (
              <p className="text-xs text-blue-300">Loading full photo & clinical details…</p>
            )}

            {/* Patient Vitals Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Age</span>
                <p className="text-sm font-bold text-white mt-0.5">{selected.patient_age ?? '—'} yrs</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Weight</span>
                <p className="text-sm font-bold text-white mt-0.5">{selected.patient_weight_kg ?? '—'} kg</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Blood Pressure</span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {selected.bp_systolic ?? '—'}/{selected.bp_diastolic ?? '—'} mmHg
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Blood Sugar</span>
                <p className="text-sm font-bold text-white mt-0.5">{selected.blood_sugar ?? '—'} mg/dL</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                <span className="text-[10px] text-slate-400 uppercase font-bold">AI Metrics</span>
                <p className="text-xs font-bold text-emerald-300 mt-0.5">
                  {selected.ai_area_cm2 ? `${Number(selected.ai_area_cm2).toFixed(2)} cm²` : 'Checked'}
                  {selected.ai_wagner_grade !== undefined && selected.ai_wagner_grade !== null
                    ? ` · Wagner ${selected.ai_wagner_grade}`
                    : ''}
                </p>
              </div>
            </div>

            {selected.ai_rejection_reason && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-700/50 text-rose-200 text-xs">
                <strong>AI Rejection Reason:</strong> {selected.ai_rejection_reason}
              </div>
            )}

            {/* 3 Photos + AI Annotated Overlays */}
            <ThreePhotoInspector photos={selected.photos || []} />

            {/* Previous Medical Reports */}
            {Array.isArray(selected.reports) && selected.reports.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0C152E] border border-[#23355E] space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Uploaded Medical Reports ({selected.reports.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selected.reports.map((rep) => (
                    <a
                      key={rep.report_id || rep.file_name}
                      href={resolveAssetUrl(rep.file_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#162347] hover:bg-[#1E2F5E] border border-[#2A3F75] text-xs text-blue-300 font-semibold"
                    >
                      📄 {rep.file_name || 'Medical Report'} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Moderator Review & Doctor Clinical Note */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0C152E] border border-[#23355E] space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300">Moderator QA Review</h4>
                <p className="text-xs text-slate-300">
                  <strong>Moderator:</strong> {selected.moderator_name || selected.moderator_id || 'Pending'}
                </p>
                <p className="text-xs text-slate-300">
                  <strong>Decision:</strong> {selected.moderator_decision || 'Awaiting review'}
                </p>
                <p className="text-xs text-slate-400">
                  <strong>Note / Reason:</strong> {selected.moderator_note || '—'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0C152E] border border-[#23355E] space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">Doctor Clinical Note</h4>
                <p className="text-xs text-slate-300">
                  <strong>Doctor:</strong> {selected.doctor_name || selected.doctor_id || 'Pending'}
                </p>
                <p className="text-xs text-slate-300">
                  <strong>Diagnosis:</strong> {selected.diagnosis || '—'} {selected.severity ? `(${selected.severity})` : ''}
                </p>
                <p className="text-xs text-slate-300">
                  <strong>Treatment:</strong> {selected.treatment_needed || '—'}
                </p>
                <p className="text-xs text-slate-400">
                  <strong>Medication:</strong> {selected.medication || '—'}
                </p>
              </div>
            </div>

            {/* Admin Override Controls */}
            <div className="p-4 rounded-xl bg-[#0A1124] border border-amber-700/40 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                ⚙️ Administrative Override Controls
              </h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Enter audit reason for Force Accept / Force Reject…"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white placeholder-slate-500"
                />
                <button
                  type="button"
                  disabled={overrideBusy}
                  onClick={() => handleOverride('accepted')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  ✓ Force Accept
                </button>
                <button
                  type="button"
                  disabled={overrideBusy}
                  onClick={() => handleOverride('rejected')}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  ✕ Force Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
