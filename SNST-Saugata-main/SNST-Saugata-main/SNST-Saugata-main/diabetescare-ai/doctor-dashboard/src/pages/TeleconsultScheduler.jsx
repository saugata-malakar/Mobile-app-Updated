import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchTeleconsults, scheduleTeleconsult } from '../services/doctorService';

export default function TeleconsultScheduler() {
  const [search] = useSearchParams();
  const prefillPatient = search.get('patientId');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchTeleconsults();
        setItems(list);
        if (prefillPatient) {
          const match = list.find(t => t.patient_id === prefillPatient);
          if (match) setSelected(match.id);
        } else if (list[0]) {
          setSelected(list[0].id);
        }
      } catch (e) {
        setError(e.response?.data?.error?.message || 'Failed to load teleconsults');
      } finally {
        setLoading(false);
      }
    })();
  }, [prefillPatient]);

  const submit = async e => {
    e.preventDefault();
    if (!selected || !scheduledAt) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const iso = new Date(scheduledAt).toISOString();
      const res = await scheduleTeleconsult(selected, iso, notes);
      setMessage(
        `Callback scheduled for ${res.patient_name || 'patient'} at ${new Date(res.scheduled_at).toLocaleString('en-IN')}`,
      );
      const list = await fetchTeleconsults();
      setItems(list);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Scheduling failed');
    } finally {
      setSaving(false);
    }
  };

  const current = items.find(t => t.id === selected);

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/" className="text-[#2463AE] font-semibold hover:underline">
        ← Dashboard
      </Link>
      <h2 className="text-2xl font-bold text-[#1A3A5C]">Teleconsult scheduler</h2>
      <p className="text-[#5A5A5A] text-sm">
        Book a phone callback — the doctor calls the patient&apos;s registered number at the
        scheduled time.
      </p>

      {loading ? (
        <p className="text-[#5A5A5A]">Loading requests…</p>
      ) : (
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white border border-[#D4D9E0] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-[#F4F8FC] font-bold text-[#1A3A5C]">
              Pending requests ({items.length})
            </div>
            <ul className="divide-y divide-[#D4D9E0] max-h-[400px] overflow-y-auto">
              {items.length === 0 ? (
                <li className="p-5 text-[#5A5A5A]">No pending teleconsults.</li>
              ) : (
                items.map(t => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(t.id)}
                      className={`w-full text-left p-4 hover:bg-[#F4F8FC] ${
                        selected === t.id ? 'bg-[#E8F3DC]' : ''
                      }`}>
                      <div className="font-semibold">{t.patient_name}</div>
                      <div className="text-xs text-[#5A5A5A]">
                        {t.request_type} · {t.status}
                      </div>
                      <div className="text-sm mt-1 line-clamp-2">{t.patient_concern_en}</div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <form
            onSubmit={submit}
            className="bg-white border border-[#D4D9E0] rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-[#1A3A5C]">Schedule callback</h3>
            {current ? (
              <p className="text-sm">
                Patient: <strong>{current.patient_name}</strong> ({current.patient_phone})
              </p>
            ) : null}
            <div>
              <label className="block text-sm font-semibold mb-1">Date & time (local)</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                required
                className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Doctor notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3"
                placeholder="Prep instructions for callback…"
              />
            </div>
            {error ? <p className="text-sm text-[#7B1818]">{error}</p> : null}
            {message ? <p className="text-sm text-[#0D6B55] font-semibold">{message}</p> : null}
            <button
              type="submit"
              disabled={saving || !selected}
              className="bg-[#0D6B55] text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50">
              {saving ? 'Booking…' : 'Book callback'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
