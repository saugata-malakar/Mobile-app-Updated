import { useEffect, useState } from 'react';
import {
  fetchModeratorQueue,
  fetchMyPayments,
  fetchSubmissionDetail,
  getStoredUser,
  moderatorApprove,
  moderatorReject,
} from '../services/api';
import {
  formatDateTime,
  formatRupees,
  normalizeArray,
} from '../utils/workflowUtils';
import {
  RoleBadge,
  StatusBadge,
  ThreePhotoInspector,
} from '../components/WorkflowShared';

const REJECT_REASONS = [
  'Blurry / Out of focus photo(s)',
  'Reference coin missing or obscured',
  'Wound / body part cropped or covered',
  'Filter / edited / unnatural lighting',
  'Incomplete 3-photo sequence (Distance / Closer / Even Closer)',
  'Suspected duplicate or mismatched patient record',
  'Other (specify below)',
];

const QUEUE_TABS = [
  { key: 'ai_reviewed', label: 'Pending Review' },
  { key: 'moderator_approved', label: 'Approved' },
  { key: 'moderator_rejected', label: 'Rejected' },
  { key: 'all', label: 'All History' },
];

export default function ModeratorDashboard() {
  const user = getStoredUser();
  const [statusTab, setStatusTab] = useState('ai_reviewed');
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [earnings, setEarnings] = useState({ total_earned: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  const [approveNote, setApproveNote] = useState('');
  const [rejectReasonKey, setRejectReasonKey] = useState(REJECT_REASONS[0]);
  const [rejectCustomText, setRejectCustomText] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadQueueAndEarnings = async (tab = statusTab) => {
    setLoading(true);
    try {
      const [qRes, pRes] = await Promise.all([
        fetchModeratorQueue(tab),
        fetchMyPayments(user?.user_id).catch(() => null),
      ]);
      const items = normalizeArray(qRes, ['queue', 'submissions', 'items']);
      setQueue(items);

      if (items.length > 0) {
        const keep = items.find((i) => i.submission_id === selected?.submission_id) || items[0];
        selectSubmission(keep);
      } else {
        setSelected(null);
      }

      if (pRes && typeof pRes === 'object') {
        const payList = normalizeArray(pRes, ['payments', 'items']);
        const total = pRes.total_earned ?? payList.reduce((acc, p) => acc + Number(p.amount || 0), 0);
        setEarnings({ total_earned: total, count: payList.length });
      }
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Could not load moderator queue.');
    } finally {
      setLoading(false);
    }
  };

  const selectSubmission = async (item) => {
    setSelected(item);
    setApproveNote('');
    setRejectCustomText('');
    try {
      const full = await fetchSubmissionDetail(item.submission_id);
      if (full) {
        setSelected(full.submission ? { ...full.submission, ...full } : full);
      }
    } catch {
      // keep queue item data
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchModeratorQueue(statusTab),
      fetchMyPayments(user?.user_id).catch(() => null),
    ])
      .then(([qRes, pRes]) => {
        if (cancelled) return;
        const items = normalizeArray(qRes, ['queue', 'submissions', 'items']);
        setQueue(items);
        if (items.length > 0) {
          const keep = items.find((i) => i.submission_id === selected?.submission_id) || items[0];
          selectSubmission(keep);
        } else {
          setSelected(null);
        }
        if (pRes && typeof pRes === 'object') {
          const payList = normalizeArray(pRes, ['payments', 'items']);
          const total = pRes.total_earned ?? payList.reduce((acc, p) => acc + Number(p.amount || 0), 0);
          setEarnings({ total_earned: total, count: payList.length });
        }
      })
      .catch((err) => {
        if (!cancelled) setFeedback(err?.response?.data?.detail || 'Could not load moderator queue.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  const handleApprove = async () => {
    if (!selected) return;
    setActionBusy(true);
    setFeedback('');
    try {
      await moderatorApprove(selected.submission_id, approveNote.trim() || '3-photo protocol & coin verified.');
      setFeedback(`✓ Approved ${selected.submission_id}! Credited ₹20 and routed to Doctor Validation Queue.`);
      await loadQueueAndEarnings(statusTab);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Failed to approve submission.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    const finalReason =
      rejectReasonKey === 'Other (specify below)'
        ? rejectCustomText.trim()
        : rejectCustomText.trim()
        ? `${rejectReasonKey}: ${rejectCustomText.trim()}`
        : rejectReasonKey;

    if (!finalReason) {
      setFeedback('Please provide a rejection reason.');
      return;
    }

    setActionBusy(true);
    setFeedback('');
    try {
      await moderatorReject(selected.submission_id, finalReason);
      setFeedback(`✕ Rejected ${selected.submission_id} with reason: "${finalReason}".`);
      await loadQueueAndEarnings(statusTab);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Failed to reject submission.');
    } finally {
      setActionBusy(false);
    }
  };

  const isPendingReview = selected && String(selected.status).toLowerCase() === 'ai_reviewed';

  return (
    <div className="space-y-5 max-w-7xl font-sans">
      {/* Header + Earnings Strip */}
      <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400">
            Moderator QA Workstation · ₹20 per Verified Record
          </span>
          <h2 className="text-xl font-bold text-white mt-0.5">ASHA / ICDS / CHO Review Queue</h2>
          <p className="text-xs text-slate-400">
            Verify patient vitals, 3-shot image clarity & reference coin placement before forwarding to Doctor Clinical Note Queue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#0C152E] border border-emerald-700/50">
            <span className="block text-[10px] text-slate-400 uppercase font-bold">Moderator Earnings</span>
            <span className="text-base font-bold text-emerald-400">{formatRupees(earnings.total_earned)}</span>
            <span className="text-[10px] text-slate-400 ml-1.5">({earnings.count} payouts)</span>
          </div>
          <button
            type="button"
            onClick={() => loadQueueAndEarnings(statusTab)}
            className="px-3.5 py-2.5 rounded-xl bg-[#1A284D] hover:bg-[#23355E] text-white text-xs font-bold border border-[#2A3F75]"
          >
            ↻ Refresh Queue
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {QUEUE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusTab(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              statusTab === t.key
                ? 'bg-violet-600 text-white border-violet-500 shadow'
                : 'bg-[#111C38] text-slate-300 border-[#23355E] hover:bg-[#1A284D]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-700/50 text-blue-200 text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* Side-by-side Queue & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left List */}
        <div className="lg:col-span-4 rounded-2xl bg-[#111C38] border border-[#23355E] overflow-hidden flex flex-col max-h-[75vh]">
          <div className="p-3.5 border-b border-[#1E2E54] bg-[#0E1736] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Queue ({queue.length})
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-[#1A284D] flex-1">
            {loading ? (
              <p className="p-6 text-center text-xs text-slate-400">Loading queue…</p>
            ) : queue.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No submissions in this queue.</p>
            ) : (
              queue.map((item) => {
                const isActive = selected?.submission_id === item.submission_id;
                return (
                  <button
                    key={item.submission_id}
                    type="button"
                    onClick={() => selectSubmission(item)}
                    className={`w-full text-left p-3.5 transition-colors space-y-1.5 ${
                      isActive ? 'bg-[#1B2D5B] border-l-4 border-l-violet-500' : 'hover:bg-[#152246]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {item.patient_name || 'Unnamed Patient'}
                      </span>
                      <RoleBadge role={item.submitter_role} workerType={item.worker_type} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-mono">{item.patient_id}</span>
                      <span>{item.district || 'West Bengal'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <StatusBadge status={item.status} />
                      <span className="text-[10px] text-slate-500">{formatDateTime(item.created_at)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Inspector */}
        <div className="lg:col-span-8 rounded-2xl bg-[#111C38] border border-[#23355E] p-5 space-y-5">
          {!selected ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Select an ASHA / ICDS / CHO submission from the left queue to inspect its 3 photos and approve or reject.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1E2E54] pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white">{selected.patient_name || 'Unnamed Patient'}</h3>
                    <StatusBadge status={selected.status} />
                    <RoleBadge role={selected.submitter_role} workerType={selected.worker_type} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Collected by <strong className="text-slate-200">{selected.submitted_by_name || selected.submitted_by_user_id}</strong> ·{' '}
                    <span className="font-mono">{selected.submission_id}</span> · Patient <span className="font-mono">{selected.patient_id}</span>
                  </p>
                </div>
                {selected.ai_quality_passed !== undefined && (
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                      selected.ai_quality_passed
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                        : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                    }`}
                  >
                    {selected.ai_quality_passed ? '✓ AI Quality Check Passed' : '✕ AI Quality Check Failed'}
                  </span>
                )}
              </div>

              {/* Patient Vitals */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Age / Weight</span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {selected.patient_age ?? '—'} yrs · {selected.patient_weight_kg ?? '—'} kg
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Blood Pressure</span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {selected.bp_systolic ?? '—'}/{selected.bp_diastolic ?? '—'} mmHg
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Blood Sugar</span>
                  <p className="text-xs font-bold text-white mt-0.5">{selected.blood_sugar ?? '—'} mg/dL</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0C152E] border border-[#23355E]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Comorbidities</span>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                    {Array.isArray(selected.comorbidities)
                      ? selected.comorbidities.join(', ') || 'None'
                      : selected.comorbidities_json || 'None'}
                  </p>
                </div>
              </div>

              {/* 3 Zoomable Photos */}
              <ThreePhotoInspector photos={selected.photos || []} />

              {/* Review Actions */}
              {isPendingReview ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#1E2E54]">
                  {/* Approve Box */}
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-700/40 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Approve & Forward to Doctor (+₹20)
                    </h4>
                    <textarea
                      rows={2}
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      placeholder="Optional QA verification note (e.g. All 3 angles clear, coin visible)…"
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white placeholder-slate-500"
                    />
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleApprove}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow disabled:opacity-50"
                    >
                      {actionBusy ? 'Processing…' : '✓ Approve Submission (Credit ₹20)'}
                    </button>
                  </div>

                  {/* Reject Box */}
                  <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-700/40 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                      Reject with Reason (₹0)
                    </h4>
                    <select
                      value={rejectReasonKey}
                      onChange={(e) => setRejectReasonKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
                    >
                      {REJECT_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={rejectCustomText}
                      onChange={(e) => setRejectCustomText(e.target.value)}
                      placeholder="Additional details for field collector…"
                      className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white placeholder-slate-500"
                    />
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleReject}
                      className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow disabled:opacity-50"
                    >
                      {actionBusy ? 'Processing…' : '✕ Reject Submission'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#0C152E] border border-[#23355E] text-xs text-slate-300">
                  <strong>Review Outcome:</strong> {selected.moderator_decision || selected.status}{' '}
                  {selected.moderator_note ? `— "${selected.moderator_note}"` : ''}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
