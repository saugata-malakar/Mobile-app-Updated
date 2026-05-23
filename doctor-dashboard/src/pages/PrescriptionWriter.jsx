import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPatientSummary, writePrescription } from '../services/doctorService';

const emptyMed = () => ({ name: '', dose: '', frequency: '', duration: '', instructions: '' });

export default function PrescriptionWriter() {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [diagnosis, setDiagnosis] = useState('Diabetic foot ulcer — ongoing management');
  const [medications, setMedications] = useState([emptyMed()]);
  const [woundCare, setWoundCare] = useState('');
  const [dressingType, setDressingType] = useState('');
  const [dressingFreq, setDressingFreq] = useState('');
  const [referralRequired, setReferralRequired] = useState(false);
  const [referralSpeciality, setReferralSpeciality] = useState('');
  const [referralUrgency, setReferralUrgency] = useState('ROUTINE');
  const [referralReason, setReferralReason] = useState('');
  const [followUpDays, setFollowUpDays] = useState(7);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPatientSummary(patientId)
      .then(s => setPatient(s?.patient))
      .catch(() => setError('Could not load patient'))
      .finally(() => setLoading(false));
  }, [patientId]);

  const updateMed = (idx, field, value) => {
    setMedications(meds => meds.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const meds = medications.filter(m => m.name.trim());
      await writePrescription({
        patient_id: patientId,
        diagnosis,
        medications: meds,
        wound_care_instructions_en: woundCare,
        dressing_type: dressingType || undefined,
        dressing_change_frequency: dressingFreq || undefined,
        referral_required: referralRequired,
        referral_speciality: referralRequired ? referralSpeciality : undefined,
        referral_urgency: referralRequired ? referralUrgency : undefined,
        referral_reason: referralRequired ? referralReason : undefined,
        follow_up_days: followUpDays,
      });
      setMessage('Prescription saved and sent to patient record.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-[#5A5A5A]">Loading…</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <Link to={`/patients/${patientId}`} className="text-[#2463AE] font-semibold hover:underline">
        ← Wound detail
      </Link>
      <h2 className="text-2xl font-bold text-[#1A3A5C]">
        Prescription — {patient?.name}
      </h2>

      <form onSubmit={submit} className="bg-white border border-[#D4D9E0] rounded-xl p-8 space-y-6">
        <div>
          <label className="block text-sm font-semibold mb-1">Diagnosis</label>
          <input
            value={diagnosis}
            onChange={e => setDiagnosis(e.target.value)}
            className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3"
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-[#1A3A5C]">Medications</h3>
            <button
              type="button"
              onClick={() => setMedications(m => [...m, emptyMed()])}
              className="text-sm text-[#2463AE] font-semibold">
              + Add medication
            </button>
          </div>
          {medications.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-2 mb-3 border border-[#D4D9E0] rounded-lg p-3 bg-[#F4F8FC]">
              <input
                placeholder="Name"
                value={m.name}
                onChange={e => updateMed(i, 'name', e.target.value)}
                className="border border-[#D4D9E0] rounded px-2 py-2 text-sm"
              />
              <input
                placeholder="Dose"
                value={m.dose}
                onChange={e => updateMed(i, 'dose', e.target.value)}
                className="border border-[#D4D9E0] rounded px-2 py-2 text-sm"
              />
              <input
                placeholder="Frequency"
                value={m.frequency}
                onChange={e => updateMed(i, 'frequency', e.target.value)}
                className="border border-[#D4D9E0] rounded px-2 py-2 text-sm"
              />
              <input
                placeholder="Duration"
                value={m.duration}
                onChange={e => updateMed(i, 'duration', e.target.value)}
                className="border border-[#D4D9E0] rounded px-2 py-2 text-sm"
              />
              <input
                placeholder="Instructions"
                value={m.instructions}
                onChange={e => updateMed(i, 'instructions', e.target.value)}
                className="border border-[#D4D9E0] rounded px-2 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Wound care instructions</label>
          <textarea
            value={woundCare}
            onChange={e => setWoundCare(e.target.value)}
            rows={3}
            className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3"
            placeholder="Dressing protocol, offloading, hygiene…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Dressing type</label>
            <input
              value={dressingType}
              onChange={e => setDressingType(e.target.value)}
              className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Change frequency</label>
            <input
              value={dressingFreq}
              onChange={e => setDressingFreq(e.target.value)}
              className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3"
            />
          </div>
        </div>

        <div className="border border-[#D4D9E0] rounded-lg p-4">
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={referralRequired}
              onChange={e => setReferralRequired(e.target.checked)}
            />
            Referral required
          </label>
          {referralRequired ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <input
                placeholder="Specialist"
                value={referralSpeciality}
                onChange={e => setReferralSpeciality(e.target.value)}
                className="border border-[#D4D9E0] rounded-lg px-4 py-3"
              />
              <select
                value={referralUrgency}
                onChange={e => setReferralUrgency(e.target.value)}
                className="border border-[#D4D9E0] rounded-lg px-4 py-3">
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
              <textarea
                placeholder="Referral reason"
                value={referralReason}
                onChange={e => setReferralReason(e.target.value)}
                rows={2}
                className="col-span-2 border border-[#D4D9E0] rounded-lg px-4 py-3"
              />
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Follow-up (days)</label>
          <input
            type="number"
            min={1}
            max={90}
            value={followUpDays}
            onChange={e => setFollowUpDays(Number(e.target.value))}
            className="w-32 border border-[#D4D9E0] rounded-lg px-4 py-3"
          />
        </div>

        {error ? <p className="text-[#7B1818] text-sm">{error}</p> : null}
        {message ? <p className="text-[#0D6B55] font-semibold">{message}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="bg-[#1A3A5C] text-white font-bold px-8 py-3 rounded-lg hover:bg-[#2463AE] disabled:opacity-60">
          {saving ? 'Saving…' : 'Issue prescription'}
        </button>
      </form>
    </div>
  );
}
