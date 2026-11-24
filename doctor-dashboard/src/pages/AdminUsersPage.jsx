import { useEffect, useState } from 'react';
import { fetchAdminUsers, updateAdminUser } from '../services/api';
import { formatDateTime, normalizeArray } from '../utils/workflowUtils';
import { RoleBadge, StatusBadge } from '../components/WorkflowShared';

const ROLE_FILTERS = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'doctor', label: 'Doctors' },
  { value: 'field_worker', label: 'ASHA / ICDS / CHO' },
  { value: 'moderator', label: 'Moderators' },
  { value: 'admin', label: 'Admins' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadUsers = async (r = roleFilter, s = search) => {
    setLoading(true);
    try {
      const res = await fetchAdminUsers(r, s);
      setUsers(normalizeArray(res, ['users', 'items']));
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Could not load users from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchAdminUsers(roleFilter, search)
      .then((res) => {
        if (!cancelled) setUsers(normalizeArray(res, ['users', 'items']));
      })
      .catch((err) => {
        if (!cancelled) setFeedback(err?.response?.data?.detail || 'Could not load users from backend.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    setBusyId(user.user_id);
    setFeedback('');
    try {
      await updateAdminUser(user.user_id, { status: nextStatus });
      setUsers((prev) => prev.map((u) => (u.user_id === user.user_id ? { ...u, status: nextStatus } : u)));
      setFeedback(`Updated ${user.full_name || user.user_id} status to ${nextStatus}.`);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Failed to update user status.');
    } finally {
      setBusyId('');
    }
  };

  const handleRoleChange = async (user, nextRole) => {
    if (nextRole === user.role) return;
    setBusyId(user.user_id);
    setFeedback('');
    try {
      await updateAdminUser(user.user_id, { role: nextRole });
      setUsers((prev) => prev.map((u) => (u.user_id === user.user_id ? { ...u, role: nextRole } : u)));
      setFeedback(`Changed ${user.full_name || user.user_id} role to ${nextRole}.`);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || 'Failed to change user role.');
    } finally {
      setBusyId('');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadUsers(roleFilter, search);
  };

  return (
    <div className="space-y-5 max-w-7xl font-sans">
      <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Admin · Identity & Access</span>
          <h2 className="text-xl font-bold text-white mt-0.5">User Management (4 Roles)</h2>
          <p className="text-xs text-slate-400">
            Search, filter, activate/suspend accounts, or reassign roles across Doctors, ASHA/ICDS/CHO, Moderators, and Admins.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, worker ID…"
            className="w-64 px-3 py-2 rounded-lg bg-[#0C152E] border border-[#253966] text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
          >
            Search
          </button>
        </form>
      </div>

      {/* Role Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {ROLE_FILTERS.map((rf) => (
          <button
            key={rf.value}
            type="button"
            onClick={() => setRoleFilter(rf.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              roleFilter === rf.value
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#111C38] text-slate-300 border-[#23355E] hover:bg-[#1A284D]'
            }`}
          >
            {rf.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-700/50 text-blue-200 text-xs font-semibold">
          {feedback}
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl bg-[#111C38] border border-[#23355E] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading registered accounts…</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No users matched the current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1736] text-[10px] uppercase text-slate-400 border-b border-[#23355E]">
                <tr>
                  <th className="py-3 px-4">User & IDs</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Role / Subtype</th>
                  <th className="py-3 px-4">District / Spec.</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Change Role</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A284D]">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-[#162347]/50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">{u.full_name || u.username || 'Unnamed'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {u.worker_id || u.username || u.user_id}
                      </p>
                      <p className="text-[10px] text-slate-500">{formatDateTime(u.created_at)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-200">{u.email || '—'}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{u.phone || '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <RoleBadge role={u.role} workerType={u.worker_type} />
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {u.district || u.specialization || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={u.status || 'active'} />
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        disabled={busyId === u.user_id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="px-2 py-1 rounded bg-[#0C152E] border border-[#253966] text-xs text-white"
                      >
                        <option value="doctor">doctor</option>
                        <option value="field_worker">field_worker</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={busyId === u.user_id}
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          u.status === 'suspended'
                            ? 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
                            : 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-700/60'
                        }`}
                      >
                        {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
