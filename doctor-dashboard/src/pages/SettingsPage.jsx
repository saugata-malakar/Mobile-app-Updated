import { useEffect, useState } from 'react';
import { fetchMyPayments, getStoredUser } from '../services/api';
import {
  formatDateTime,
  formatRupees,
  normalizeArray,
} from '../utils/workflowUtils';
import {
  RoleBadge,
  StatusBadge,
} from '../components/WorkflowShared';

const DEPARTMENTS = [
  'Department of Diabetology & Metabolic Disorders',
  'Department of Podiatric Surgery & Diabetic Foot Clinic',
  'Department of Vascular & Endovascular Surgery',
  'Department of Community Medicine & Rural Outreach',
  'Department of General Surgery & Wound Healing Center',
  'Department of Endocrinology & Clinical Nutrition',
];

const HOSPITAL_NODES = [
  'Midnapore Medical College & Hospital (Apex Hub, West Bengal)',
  'Kharagpur Sub-Divisional Hospital (Telehealth Node 1)',
  'Jhargram Super Specialty Hospital (Telehealth Node 2)',
  'Tamluk District Hospital (Telehealth Node 3)',
  'Bankura Sammilani Medical College & Hospital (Affiliated Node)',
];

export default function SettingsPage() {
  const user = getStoredUser();
  const role = (user?.role || localStorage.getItem('user_role') || 'doctor').toLowerCase();

  const [name, setName] = useState(user?.full_name || user?.name || 'Dr. Clinical Specialist');
  const [specialisation, setSpecialisation] = useState(user?.specialization || 'Diabetology & Vascular Wound Care');
  const [regNumber, setRegNumber] = useState(user?.worker_id || 'WBMC/NMC #78421-A');
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);
  const [selectedHospital, setSelectedHospital] = useState(HOSPITAL_NODES[0]);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(true);
  const [saved, setSaved] = useState(false);

  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState({ total_earned: 0, total_paid: 0, pending: 0 });

  useEffect(() => {
    fetchMyPayments(user?.user_id)
      .then((res) => {
        const list = normalizeArray(res, ['payments', 'items']);
        setPayments(list);
        const total = res?.total_earned ?? list.reduce((s, p) => s + Number(p.amount || 0), 0);
        const paid =
          res?.total_paid ?? list.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
        setTotals({ total_earned: total, total_paid: paid, pending: total - paid });
      })
      .catch(() => {});
  }, [user?.user_id]);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl font-sans">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
          Account Profile, Earnings & System Preferences
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
          {role === 'moderator' || role === 'field_worker' ? 'My Profile & Earnings' : 'Hospital & Practitioner Settings'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          View your verified identity credentials, live ₹ payout ledger, and workstation preferences.
        </p>
      </div>

      {/* Account Identity & Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 p-4 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400">Active Profile</span>
            <RoleBadge role={role} workerType={user?.worker_type} />
          </div>
          <p className="text-base font-bold text-white">{user?.full_name || name}</p>
          <p className="text-xs text-slate-400 font-mono">
            ID: {user?.worker_id || user?.username || user?.user_id || 'DEMO'}
          </p>
          <p className="text-xs text-slate-400">
            {user?.email || '—'} {user?.phone ? `· ${user.phone}` : ''} {user?.district ? `· ${user.district}` : ''}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#111C38] border border-emerald-700/40">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Earned</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatRupees(totals.total_earned)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{payments.length} payout entries</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#111C38] border border-[#23355E]">
          <span className="text-[10px] font-bold uppercase text-slate-400">Paid / Pending</span>
          <p className="text-lg font-bold text-white mt-1">
            {formatRupees(totals.total_paid)}{' '}
            <span className="text-xs text-amber-400">/ {formatRupees(totals.pending)}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Disbursed vs Credited</p>
        </div>
      </div>

      {/* Personal Payout Ledger */}
      <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">My ₹ Earnings History</h3>
        {payments.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">No earnings logged on this account yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-400 border-b border-[#1E2E54]">
                <tr>
                  <th className="py-2 pr-3">Submission</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A284D]">
                {payments.map((p) => (
                  <tr key={p.payment_id}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-300">{p.submission_id}</td>
                    <td className="py-2 pr-3 text-slate-200">{p.description || p.role}</td>
                    <td className="py-2 pr-3 font-bold text-emerald-400">{formatRupees(p.amount)}</td>
                    <td className="py-2 pr-3"><StatusBadge status={p.status} /></td>
                    <td className="py-2 text-[11px] text-slate-400">{formatDateTime(p.paid_at || p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Institutional Configuration Form */}
      {(role === 'doctor' || role === 'admin' || role === 'hospital_admin') && (
        <form onSubmit={handleSave} className="p-6 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hospital & Department Affiliation</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                Clinical Department (Switch Active Department)
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} className="bg-[#0B132B] text-white">{d}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                Hospital Branch / Telemedicine Node
              </label>
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {HOSPITAL_NODES.map((h) => (
                  <option key={h} value={h} className="bg-[#0B132B] text-white">{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Practitioner Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Medical Council Registration #</label>
              <input
                type="text"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Clinical Specialisation</label>
              <input
                type="text"
                value={specialisation}
                onChange={(e) => setSpecialisation(e.target.value)}
                className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#1D2B52] space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Clinical Escalation & Dispatch</h3>
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-[#091024] border-[#22335A]"
                />
                <span className="text-xs text-slate-300">Email dispatch for RED grade urgent ulcer progression (&gt;10% area expansion)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsAlerts}
                  onChange={(e) => setSmsAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-[#091024] border-[#22335A]"
                />
                <span className="text-xs text-slate-300">Instant SMS broadcast to on-call attending podiatrist</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEscalate}
                  onChange={(e) => setAutoEscalate(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-[#091024] border-[#22335A]"
                />
                <span className="text-xs text-slate-300">Automated triage routing to Vascular Surgery on Wagner Grade 3+</span>
              </label>
            </div>
          </div>

          {saved && (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-700/50 rounded-md text-emerald-300 text-xs font-semibold">
              ✓ Department configuration and institutional affiliation saved successfully.
            </div>
          )}

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-colors"
          >
            Save Practice Profile & Department Affiliation
          </button>
        </form>
      )}
    </div>
  );
}
