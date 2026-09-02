import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AlertBanner from '../components/AlertBanner';
import { fetchPatientSummary, fetchWoundDetail } from '../services/doctorService';

export default function PatientWoundDetail() {
  const { patientId } = useParams();
  const [search] = useSearchParams();
  const woundSiteId = search.get('woundSiteId') || undefined;
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, d] = await Promise.all([
          fetchPatientSummary(patientId),
          fetchWoundDetail(patientId, woundSiteId),
        ]);
        setSummary(s);
        setDetail(d);
      } catch (e) {
        setError(e.response?.data?.error?.message || 'Failed to load wound data');
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, woundSiteId]);

  if (loading) return <div className="text-[#5A5A5A]">Loading wound detail…</div>;
  if (error) {
    return (
      <div className="bg-[#FBE8E8] border border-[#C0392B] rounded-lg p-6 text-[#7B1818]">{error}</div>
    );
  }

  const chartData =
    detail?.chart?.labels?.map((label, i) => ({
      date: label,
      area: detail.chart.areas[i],
      wagner: detail.chart.wagner[i],
    })) ?? [];

  const topAlert = summary?.open_alerts?.[0];
  const latest = detail?.latest_session;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-[#2463AE] font-semibold hover:underline">
          ← Dashboard
        </Link>
        <h2 className="text-2xl font-bold text-[#1A3A5C]">
          {summary?.patient?.name} — Wound monitoring
        </h2>
      </div>

      <p className="text-xs text-[#5A5A5A] italic">
        AI-assisted screening only. Not a medical diagnosis.
      </p>

      {topAlert ? (
        <AlertBanner
          level={topAlert.alert_level}
          message={topAlert.message_doctor_en || topAlert.alert_type}
        />
      ) : null}

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border border-[#D4D9E0] rounded-xl p-5 col-span-1">
          <h3 className="font-bold text-[#1A3A5C] mb-3">Patient</h3>
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-[#5A5A5A]">Phone</dt>
              <dd className="font-semibold">{summary?.patient?.phone}</dd>
            </div>
            <div>
              <dt className="text-[#5A5A5A]">Age / gender</dt>
              <dd className="font-semibold">
                {summary?.patient?.age} · {summary?.patient?.gender}
              </dd>
            </div>
            <div>
              <dt className="text-[#5A5A5A]">Village</dt>
              <dd className="font-semibold">{summary?.patient?.village}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to={`/prescriptions/${patientId}`}
              className="text-center bg-[#1A3A5C] text-white font-bold py-2 rounded-lg hover:bg-[#2463AE]">
              Write prescription
            </Link>
            <Link
              to={`/teleconsults?patientId=${patientId}`}
              className="text-center border border-[#2463AE] text-[#2463AE] font-bold py-2 rounded-lg hover:bg-[#F4F8FC]">
              Schedule teleconsult
            </Link>
          </div>
        </div>

        <div className="bg-white border border-[#D4D9E0] rounded-xl p-5 col-span-2">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-[#1A3A5C]">Wound area trend (cm²)</h3>
            <span
              className={`text-sm font-bold px-3 py-1 rounded ${
                detail?.trend === 'healing'
                  ? 'bg-[#E8F3DC] text-[#234F09]'
                  : detail?.trend === 'worsening'
                    ? 'bg-[#FBE8E8] text-[#7B1818]'
                    : 'bg-[#FEF3E2] text-[#7A3B00]'
              }`}>
              Trend: {detail?.trend}
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="h-[320px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4D9E0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="area"
                    name="Area (cm²)"
                    stroke="#2463AE"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wagner"
                    name="Wagner grade"
                    stroke="#E67E00"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-8 text-[#5A5A5A]">No submitted wound sessions yet.</p>
          )}
          {latest ? (
            <div className="mt-4 grid grid-cols-4 gap-4 text-sm border-t border-[#D4D9E0] pt-4">
              <div>
                <span className="text-[#5A5A5A]">Latest area</span>
                <div className="font-bold text-lg">{latest.wound_area_cm2 ?? '—'} cm²</div>
              </div>
              <div>
                <span className="text-[#5A5A5A]">Wagner</span>
                <div className="font-bold text-lg">{latest.wagner_grade ?? '—'}</div>
              </div>
              <div>
                <span className="text-[#5A5A5A]">Alert</span>
                <div className="font-bold text-lg">{latest.alert_level ?? '—'}</div>
              </div>
              <div>
                <span className="text-[#5A5A5A]">Confidence</span>
                <div className="font-bold text-lg">
                  {latest.overall_confidence != null
                    ? `${Math.round(latest.overall_confidence * 100)}%`
                    : '—'}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {summary?.wound_sites?.length > 0 ? (
        <div className="bg-white border border-[#D4D9E0] rounded-xl p-5">
          <h3 className="font-bold text-[#1A3A5C] mb-3">Wound sites</h3>
          <div className="flex gap-3 flex-wrap">
            {summary.wound_sites.map(ws => (
              <Link
                key={ws.id}
                to={`/patients/${patientId}?woundSiteId=${ws.id}`}
                className="border border-[#D4D9E0] rounded-lg px-4 py-2 text-sm hover:border-[#2463AE]">
                {ws.foot_side} · {ws.location_on_foot}
                {ws.toe_number ? ` (toe ${ws.toe_number})` : ''}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
