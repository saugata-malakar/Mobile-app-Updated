import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AlertBanner from '../components/AlertBanner';
import { acknowledgeAlert, fetchAlerts, fetchPatientSummary } from '../services/doctorService';

export default function AlertManagement() {
  const { alertId } = useParams();
  const [search] = useSearchParams();
  const patientId = search.get('patientId');
  const [alert, setAlert] = useState(null);
  const [patient, setPatient] = useState(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const alerts = await fetchAlerts(false);
        const found = alerts.find(a => a.id === alertId);
        setAlert(found || null);
        if (patientId) {
          const s = await fetchPatientSummary(patientId);
          setPatient(s?.patient);
        }
      } catch (e) {
        setError(e.response?.data?.error?.message || 'Failed to load alert');
      } finally {
        setLoading(false);
      }
    })();
  }, [alertId, patientId]);

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await acknowledgeAlert(alertId, note);
      setMessage('Alert acknowledged and resolved.');
      const alerts = await fetchAlerts(false);
      setAlert(alerts.find(a => a.id === alertId) || { ...alert, resolved_at: new Date().toISOString() });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not acknowledge alert');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-[#5A5A5A]">Loading alert…</div>;
  if (!alert) {
    return (
      <div>
        <Link to="/" className="text-[#2463AE] font-semibold">
          ← Dashboard
        </Link>
        <p className="mt-4 text-[#7B1818]">Alert not found or already resolved.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/" className="text-[#2463AE] font-semibold hover:underline">
        ← Dashboard
      </Link>
      <h2 className="text-2xl font-bold text-[#1A3A5C]">Alert management</h2>

      <AlertBanner
        level={alert.alert_level}
        message={alert.message_doctor_en || alert.alert_type}
      />

      <div className="bg-white border border-[#D4D9E0] rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[#5A5A5A]">Patient</span>
            <div className="font-semibold">{alert.patient_name || patient?.name}</div>
          </div>
          <div>
            <span className="text-[#5A5A5A]">Phone</span>
            <div className="font-semibold">{alert.patient_phone || patient?.phone}</div>
          </div>
          <div>
            <span className="text-[#5A5A5A]">Type</span>
            <div className="font-semibold">{alert.alert_type}</div>
          </div>
          <div>
            <span className="text-[#5A5A5A]">Generated</span>
            <div className="font-semibold">
              {alert.generated_at ? new Date(alert.generated_at).toLocaleString('en-IN') : '—'}
            </div>
          </div>
        </div>

        {alert.resolved_at ? (
          <p className="text-[#0D6B55] font-semibold bg-[#E8F3DC] rounded-lg px-4 py-3">
            Resolved {new Date(alert.resolved_at).toLocaleString('en-IN')}
            {alert.acknowledgement_note ? ` — Note: ${alert.acknowledgement_note}` : ''}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4 border-t border-[#D4D9E0] pt-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Clinical note</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
                placeholder="Document review, plan, or callback instructions…"
                className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#2463AE] outline-none"
              />
            </div>
            {error ? <p className="text-[#7B1818] text-sm">{error}</p> : null}
            {message ? <p className="text-[#0D6B55] text-sm font-semibold">{message}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="bg-[#1A3A5C] text-white font-bold px-6 py-3 rounded-lg hover:bg-[#2463AE] disabled:opacity-60">
              {saving ? 'Saving…' : 'Acknowledge & resolve'}
            </button>
          </form>
        )}

        {patientId ? (
          <Link
            to={`/patients/${patientId}`}
            className="inline-block text-[#2463AE] font-semibold hover:underline">
            View wound detail →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
