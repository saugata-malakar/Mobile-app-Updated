import { useEffect, useState } from 'react';
import {
  fetchAdminPayments,
  fetchAdminRates,
  markAdminPaymentPaid,
  updateAdminRates,
} from '../services/api';
import {
  formatDateTime,
  formatRupees,
  normalizeArray,
} from '../utils/workflowUtils';
import {
  RoleBadge,
  StatusBadge,
} from '../components/WorkflowShared';

const DEFAULT_RATES = {
  doctor_direct: 80,
  doctor_helper: 20,
  field_worker: 50,
  moderator: 20,
  doctor_validation: 30,
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [savingRates, setSavingRates] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAdminPayments({ role: roleFilter, status: statusFilter }),
      fetchAdminRates().catch(() => null),
    ])
      .then(([payRes, rateRes]) => {
        if (cancelled) return;
        setPayments(normalizeArray(payRes, ['payments', 'items']));
        if (rateRes && typeof rateRes === 'object') {
          const rateObj = rateRes.rates || rateRes;
          setRates({ ...DEFAULT_RATES, ...rateObj });
        }
      })
      .catch((err) => {
        if (!cancelled) setFeedback(err?.response?.data?.detail || 'Failed to load payment ledger.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [roleFilter, statusFilter]);

  const handleMarkPaid = async (paymentId) => {
    setBusyPaymentId(paymentId);
    setFeedback('');
    try {
      await markAdminPaymentPaid(paymentId);
      setPayments((prev) =>
        prev.map((p) =>
          p.payment_id === paymentId ? { ...p, status: 'paid', paid_at: new Date().toISOString() } : p
        )
      );
      setFeedback(`Payment ${paymentId} marked as Paid.`);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Failed to mark payment as paid.');
    } finally {
      setBusyPaymentId('');
    }
  };

  const handleSaveRates = async (e) => {
    e.preventDefault();
    setSavingRates(true);
    setFeedback('');
    try {
      const numericRates = {
        doctor_direct: Number(rates.doctor_direct),
        doctor_helper: Number(rates.doctor_helper),
        field_worker: Number(rates.field_worker),
        moderator: Number(rates.moderator),
        doctor_validation: Number(rates.doctor_validation),
      };
      await updateAdminRates(numericRates);
      setFeedback('Payout rates updated successfully.');
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Failed to update payout rates.');
    } finally {
      setSavingRates(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['payment_id', 'submission_id', 'user_id', 'user_name', 'role', 'amount', 'status', 'description', 'created_at', 'paid_at'];
    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = [
      headers.join(','),
      ...payments.map((p) => headers.map((h) => escape(p[h])).join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diabetescare_payout_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paidAmount = payments
    .filter((p) => String(p.status).toLowerCase() === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <div className="space-y-6 max-w-7xl font-sans">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Admin · Financial Ledger</span>
          <h2 className="text-xl font-bold text-white mt-0.5">Payments & ₹ Payout Ledger</h2>
          <p className="text-xs text-slate-400">
            Track credits across Doctors, ASHA/ICDS/CHO field collectors, and Moderators, disburse payouts, and configure rates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
          >
            <option value="ALL">All Roles</option>
            <option value="doctor">Doctor</option>
            <option value="field_worker">ASHA / ICDS / CHO</option>
            <option value="moderator">Moderator</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="credited">Credited (Unpaid)</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={payments.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E]">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Ledger Value</span>
          <h3 className="text-2xl font-bold text-white mt-1">{formatRupees(totalAmount)}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">{payments.length} payout entries</p>
        </div>
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E]">
          <span className="text-[11px] font-bold uppercase text-slate-400">Awaiting Settlement</span>
          <h3 className="text-2xl font-bold text-amber-400 mt-1">{formatRupees(pendingAmount)}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Credited / Pending bank transfer</p>
        </div>
        <div className="p-4 rounded-xl bg-[#111C38] border border-emerald-700/40">
          <span className="text-[11px] font-bold uppercase text-slate-400">Disbursed / Paid</span>
          <h3 className="text-2xl font-bold text-emerald-400 mt-1">{formatRupees(paidAmount)}</h3>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">Marked paid by Admin</p>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-700/50 text-blue-200 text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* Configure Rates Panel */}
      <form onSubmit={handleSaveRates} className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Configure ₹ Incentive Rates</h3>
            <p className="text-[11px] text-slate-400">
              Doctor Direct (₹80 + ₹20 Helper = ₹100) · Field Collection (₹50 Collector + ₹20 Moderator + ₹30 Doctor = ₹100)
            </p>
          </div>
          <button
            type="submit"
            disabled={savingRates}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50"
          >
            {savingRates ? 'Saving…' : 'Save Rates'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { key: 'doctor_direct', label: 'Doctor Direct (₹)' },
            { key: 'doctor_helper', label: 'Helper Share (₹)' },
            { key: 'field_worker', label: 'Field Collector (₹)' },
            { key: 'moderator', label: 'Moderator (₹)' },
            { key: 'doctor_validation', label: 'Doctor Validation (₹)' },
          ].map((item) => (
            <div key={item.key}>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{item.label}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={rates[item.key] ?? 0}
                onChange={(e) => setRates((r) => ({ ...r, [item.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs font-mono text-white"
              />
            </div>
          ))}
        </div>
      </form>

      {/* Ledger Table */}
      <div className="rounded-2xl bg-[#111C38] border border-[#23355E] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading payment ledger…</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No payment records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1736] text-[10px] uppercase text-slate-400 border-b border-[#23355E]">
                <tr>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Submission / Description</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A284D]">
                {payments.map((p) => {
                  const isPaid = String(p.status).toLowerCase() === 'paid';
                  return (
                    <tr key={p.payment_id} className="hover:bg-[#162347]/50">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">{p.payment_id}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-white">{p.user_name || p.user_id}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.user_id}</p>
                      </td>
                      <td className="py-3 px-4">
                        <RoleBadge role={p.role} />
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-200">{p.description || 'Workflow incentive'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.submission_id}</p>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">{formatRupees(p.amount)}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {formatDateTime(p.paid_at || p.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isPaid ? (
                          <span className="text-[11px] text-emerald-400 font-semibold">✓ Settled</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyPaymentId === p.payment_id}
                            onClick={() => handleMarkPaid(p.payment_id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
