import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchDepartmentDashboard } from '../services/doctorService';

export default function DepartmentDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartmentDashboard()
      .then(setData)
      .catch(e => setError(e.response?.data?.error?.message || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-[#5A5A5A]">Loading department metrics…</div>;
  if (error) {
    return (
      <div className="bg-[#FBE8E8] border border-[#C0392B] rounded-lg p-6 text-[#7B1818]">{error}</div>
    );
  }

  const k = data?.kpis ?? {};
  const chartData = Object.entries(data?.alert_breakdown ?? {}).map(([level, count]) => ({
    level,
    count,
  }));

  const tiles = [
    { label: 'Patients monitored (month)', value: k.patients_monitored },
    { label: 'Wound sessions (month)', value: k.wound_sessions_month },
    { label: 'Active subscriptions', value: k.active_subscriptions },
    { label: 'Open RED alerts', value: k.open_red_alerts, danger: true },
    { label: 'Open AMBER alerts', value: k.open_amber_alerts, warn: true },
    { label: 'Pending teleconsults', value: k.pending_teleconsults },
    { label: 'Prescriptions (month)', value: k.prescriptions_issued_month },
    { label: 'Active doctors', value: k.doctors_active },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-[#2463AE] font-semibold hover:underline">
          ← Dashboard
        </Link>
        <h2 className="text-2xl font-bold text-[#1A3A5C] mt-2">Department dashboard (B2B)</h2>
        <p className="text-[#5A5A5A]">
          {data?.hospital_name} · {data?.department} · Period {data?.period}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {tiles.map(t => (
          <div
            key={t.label}
            className={`bg-white border rounded-xl p-5 ${
              t.danger
                ? 'border-[#C0392B] bg-[#FBE8E8]'
                : t.warn
                  ? 'border-[#E67E00] bg-[#FEF3E2]'
                  : 'border-[#D4D9E0]'
            }`}>
            <div className="text-sm text-[#5A5A5A]">{t.label}</div>
            <div className="text-3xl font-bold mt-2 text-[#1A3A5C]">{t.value ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#D4D9E0] rounded-xl p-6">
        <h3 className="font-bold text-[#1A3A5C] mb-4">Alerts this month by level</h3>
        {chartData.length > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D4D9E0" />
                <XAxis dataKey="level" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2463AE" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[#5A5A5A]">No alert data for this period.</p>
        )}
      </div>
    </div>
  );
}
