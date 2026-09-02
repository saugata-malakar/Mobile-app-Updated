import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AlertBanner from '../components/AlertBanner';
import { fetchAlerts, fetchDoctorStats, fetchPatients } from '../services/doctorService';

function urgencyClass(level) {
  const u = (level || '').toUpperCase();
  if (u === 'RED') return 'bg-[#FBE8E8] text-[#7B1818]';
  if (u === 'AMBER') return 'bg-[#FEF3E2] text-[#7A3B00]';
  return 'bg-[#E8F3DC] text-[#234F09]';
}

export default function DoctorDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, p, s] = await Promise.all([
          fetchAlerts(false),
          fetchPatients(),
          fetchDoctorStats().catch(() => null),
        ]);
        setAlerts(a);
        setPatients(p);
        setStats(s);
      } catch (e) {
        setError(e.response?.data?.error?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="text-[#5A5A5A]">Loading dashboard…</div>;
  }

  if (error) {
    return (
      <div className="bg-[#FBE8E8] border border-[#C0392B] rounded-lg p-6 text-[#7B1818]">
        {error}
      </div>
    );
  }

  const topAlert = alerts[0];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1A3A5C]">Clinical inbox</h2>
          <p className="text-[#5A5A5A] mt-1">
            {alerts.length} open alerts · {patients.length} patients by urgency
          </p>
        </div>
        {stats ? (
          <div className="flex gap-4 text-sm">
            <div className="bg-white border border-[#D4D9E0] rounded-lg px-4 py-2">
              <span className="text-[#5A5A5A]">Cases today</span>
              <div className="font-bold text-lg">{stats.cases_today}</div>
            </div>
            <div className="bg-white border border-[#D4D9E0] rounded-lg px-4 py-2">
              <span className="text-[#5A5A5A]">This month</span>
              <div className="font-bold text-lg">{stats.cases_this_month}</div>
            </div>
          </div>
        ) : null}
      </div>

      {topAlert ? (
        <AlertBanner
          level={topAlert.alert_level}
          message={topAlert.message_doctor_en || `Alert: ${topAlert.alert_type}`}
        />
      ) : (
        <AlertBanner level="GREEN" message="No urgent alerts in your inbox." />
      )}

      <div className="grid grid-cols-2 gap-8">
        <section className="bg-white border border-[#D4D9E0] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D4D9E0] bg-[#F4F8FC]">
            <h3 className="font-bold text-[#1A3A5C]">Alert inbox</h3>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-[#D4D9E0]">
            {alerts.length === 0 ? (
              <p className="p-6 text-[#5A5A5A]">No open alerts.</p>
            ) : (
              alerts.map(a => (
                <div key={a.id} className="p-4 hover:bg-[#F4F8FC]">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${urgencyClass(a.alert_level)}`}>
                      {a.alert_level}
                    </span>
                    <span className="text-xs text-[#5A5A5A]">
                      {a.generated_at ? new Date(a.generated_at).toLocaleString('en-IN') : ''}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">{a.patient_name}</p>
                  <p className="text-sm text-[#5A5A5A] mt-1 line-clamp-2">
                    {a.message_doctor_en}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={`/alerts/${a.id}?patientId=${a.patient_id}`}
                      className="text-sm font-semibold text-[#2463AE] hover:underline">
                      Manage alert
                    </Link>
                    <Link
                      to={`/patients/${a.patient_id}`}
                      className="text-sm font-semibold text-[#2463AE] hover:underline">
                      Wound detail
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white border border-[#D4D9E0] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D4D9E0] bg-[#F4F8FC]">
            <h3 className="font-bold text-[#1A3A5C]">Patients by urgency</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#F4F8FC] text-left text-[#5A5A5A]">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Village</th>
                <th className="px-4 py-3">Urgency</th>
                <th className="px-4 py-3">Area (cm²)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4D9E0]">
              {patients.map(p => (
                <tr key={p.patient_id} className="hover:bg-[#F4F8FC]">
                  <td className="px-4 py-3 font-semibold">
                    {p.name}
                    <div className="text-xs text-[#5A5A5A] font-normal">{p.phone}</div>
                  </td>
                  <td className="px-4 py-3">{p.village}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${urgencyClass(p.urgency)}`}>
                      {p.urgency}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.latest_wound_area_cm2 != null ? p.latest_wound_area_cm2.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/patients/${p.patient_id}`}
                      className="text-[#2463AE] font-semibold hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
