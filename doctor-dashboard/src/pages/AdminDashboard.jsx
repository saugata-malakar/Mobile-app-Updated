import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { fetchAdminPayments, fetchAdminStats, fetchAdminSubmissions } from '../services/api';
import {
  formatDateTime,
  formatRupees,
  normalizeArray,
} from '../utils/workflowUtils';
import {
  RoleBadge,
  StatusBadge,
} from '../components/WorkflowShared';

const DEFAULT_STATS = {
  total_users: 6,
  users_by_role: { doctor: 1, field_worker: 3, moderator: 1, admin: 1 },
  total_submissions: 0,
  today_submissions: 0,
  pending_ai: 0,
  pending_moderator: 0,
  pending_doctor: 0,
  accepted_count: 0,
  rejected_count: 0,
  total_payouts: 0,
  payouts_by_role: {},
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [recentSubs, setRecentSubs] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    const [s, subs, pays] = await Promise.all([
      fetchAdminStats(),
      fetchAdminSubmissions({ limit: 8 }),
      fetchAdminPayments({ limit: 6 }),
    ]);
    return { s, subs, pays };
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const { s, subs, pays } = await fetchAll();
      if (s && typeof s === 'object') {
        setStats({ ...DEFAULT_STATS, ...s });
      }
      setRecentSubs(normalizeArray(subs, ['submissions', 'items']).slice(0, 8));
      setRecentPayments(normalizeArray(pays, ['payments', 'items']).slice(0, 6));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Live backend not reachable — showing cached dashboard layout.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(({ s, subs, pays }) => {
        if (cancelled) return;
        if (s && typeof s === 'object') setStats({ ...DEFAULT_STATS, ...s });
        setRecentSubs(normalizeArray(subs, ['submissions', 'items']).slice(0, 8));
        setRecentPayments(normalizeArray(pays, ['payments', 'items']).slice(0, 6));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Live backend not reachable — showing cached dashboard layout.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const byRole = stats.users_by_role || {};
  const doctorCount = byRole.doctor ?? stats.doctor_count ?? 0;
  const fieldCount = byRole.field_worker ?? stats.field_worker_count ?? 0;
  const modCount = byRole.moderator ?? stats.moderator_count ?? 0;
  const adminCount = (byRole.admin ?? 0) + (byRole.hospital_admin ?? 0);

  const pendingMod = stats.pending_moderator ?? stats.ai_reviewed_count ?? 0;
  const pendingDoc = stats.pending_doctor ?? stats.moderator_approved_count ?? 0;
  const pendingAi = stats.pending_ai ?? 0;
  const acceptedCount = stats.accepted_count ?? stats.accepted ?? 0;
  const rejectedCount = stats.rejected_count ?? stats.rejected ?? 0;
  const totalPayouts = stats.total_payouts ?? stats.total_paid_amount ?? 0;

  const roleChartData = [
    { name: 'Doctors', count: doctorCount, color: '#3B82F6' },
    { name: 'ASHA/ICDS/CHO', count: fieldCount, color: '#14B8A6' },
    { name: 'Moderators', count: modCount, color: '#8B5CF6' },
    { name: 'Admins', count: adminCount, color: '#F59E0B' },
  ];

  const pipelineChartData = [
    { stage: 'AI Queue', count: pendingAi, color: '#38BDF8' },
    { stage: 'Moderator', count: pendingMod, color: '#F59E0B' },
    { stage: 'Doctor Val.', count: pendingDoc, color: '#6366F1' },
    { stage: 'Accepted', count: acceptedCount, color: '#10B981' },
    { stage: 'Rejected', count: rejectedCount, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6 max-w-7xl font-sans">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Admin Control Center · Midnapore Medical College & IIT KGP
          </span>
          <h2 className="text-2xl font-bold text-white mt-1">System Operations, Workforce & Payout Oversight</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time visibility across Doctor direct uploads, ASHA/ICDS/CHO field records, Moderator QA, and ₹ disbursements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-2 rounded-lg bg-[#1A284D] hover:bg-[#23355E] text-slate-200 font-bold text-xs border border-[#2A3F75]"
          >
            ↻ Refresh
          </button>
          <Link to="/admin/users" className="px-3.5 py-2 rounded-lg bg-[#1A284D] hover:bg-[#23355E] text-slate-200 font-bold text-xs border border-[#2A3F75]">
            👥 Manage Users
          </Link>
          <Link to="/admin/submissions" className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow">
            🖼️ Inspect Submissions
          </Link>
          <Link to="/admin/payments" className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow">
            ₹ Payout Ledger
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs">
          ⚠ {error}
        </div>
      )}

      {/* Top KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E]">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Registered Users</span>
          <h3 className="text-2xl font-bold text-white mt-1">{loading ? '…' : stats.total_users}</h3>
          <p className="text-[10px] text-blue-300 mt-0.5">
            Dr {doctorCount} · Field {fieldCount} · Mod {modCount} · Adm {adminCount}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E]">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Submissions</span>
          <h3 className="text-2xl font-bold text-white mt-1">{loading ? '…' : stats.total_submissions}</h3>
          <p className="text-[10px] text-sky-300 mt-0.5">{stats.today_submissions || 0} logged today</p>
        </div>

        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E]">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Pending Pipeline</span>
          <h3 className="text-2xl font-bold text-amber-400 mt-1">
            {loading ? '…' : pendingAi + pendingMod + pendingDoc}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Mod: {pendingMod} · Doctor Val: {pendingDoc}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E]">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Accepted / Rejected</span>
          <h3 className="text-2xl font-bold text-emerald-400 mt-1">
            {loading ? '…' : `${acceptedCount} / `}
            <span className="text-rose-400">{loading ? '' : rejectedCount}</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">AI + Clinical QA outcomes</p>
        </div>

        <div className="p-4 rounded-xl bg-[#111C38] border border-emerald-700/40">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total ₹ Payouts</span>
          <h3 className="text-2xl font-bold text-emerald-300 mt-1">{loading ? '…' : formatRupees(totalPayouts)}</h3>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">Credited & disbursed</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Role Distribution Across Platform
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2E54" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#23355E', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {roleChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
            Submission Workflow Stage Breakdown
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2E54" />
                <XAxis dataKey="stage" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B132B', borderColor: '#23355E', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {pipelineChartData.map((entry) => (
                    <Cell key={entry.stage} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Submissions & Recent Payments */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 p-5 rounded-2xl bg-[#111C38] border border-[#23355E]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Recent Submissions</h3>
            <Link to="/admin/submissions" className="text-xs font-semibold text-blue-400 hover:text-blue-300">
              View All & Inspect Photos →
            </Link>
          </div>
          {recentSubs.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No workflow submissions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase text-slate-400 border-b border-[#1E2E54]">
                  <tr>
                    <th className="py-2 pr-3">Patient</th>
                    <th className="py-2 pr-3">Submitted By</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A284D]">
                  {recentSubs.map((sub) => (
                    <tr key={sub.submission_id} className="hover:bg-[#162347]/50">
                      <td className="py-2.5 pr-3">
                        <p className="font-bold text-white">{sub.patient_name || 'Unnamed'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{sub.patient_id}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-200">{sub.submitted_by_name || sub.submitted_by_user_id}</span>
                          <RoleBadge role={sub.submitter_role} workerType={sub.worker_type} />
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={sub.status} />
                      </td>
                      <td className="py-2.5 text-[11px] text-slate-400">{formatDateTime(sub.updated_at || sub.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Latest Payouts</h3>
            <Link to="/admin/payments" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
              Full Ledger →
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No payouts logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {recentPayments.map((p) => (
                <div key={p.payment_id} className="p-3 rounded-xl bg-[#0C152E] border border-[#1E2E54] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{p.user_name || p.user_id}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.description || p.role}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-400">{formatRupees(p.amount)}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
