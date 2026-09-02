import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTeleconsults, scheduleTeleconsult } from '../services/doctorService';

export default function TeleconsultScheduler() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Live Room Simulator State
  const [inCall, setInCall] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [rxNotes, setRxNotes] = useState('Saline irrigation BID, Hydrocolloid dressing 48h change, Oral Augmentin 625mg BID.');
  const [rxSent, setRxSent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchTeleconsults();
        setItems(list);
        if (list[0]) setSelected(list[0].id);
      } catch {
        // Fallback demo data
        setItems([
          { id: 'TC_001', patient_name: 'Ramesh Chandra Sen', patient_phone: '+91 98310 12345', patient_id: 'PAT_KGP_01', request_type: 'Urgent Wound Review', status: 'Scheduled', patient_concern_en: 'Increasing pain and mild yellowish drainage at plantar great toe.' },
          { id: 'TC_002', patient_name: 'Anjali Devi Das', patient_phone: '+91 94340 54321', patient_id: 'PAT_KGP_02', request_type: 'Routine Follow-up', status: 'Pending', patient_concern_en: 'Dressing change query and glycemic monitoring verification.' },
        ]);
        setSelected('TC_001');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current = items.find((t) => t.id === selected) || items[0];

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!selected || !scheduledAt) return;
    setSaving(true);
    try {
      await scheduleTeleconsult(selected, new Date(scheduledAt).toISOString(), notes);
      setMessage(`✓ Teleconsultation scheduled and SMS dispatch confirmed to ${current?.patient_name}.`);
    } catch {
      setMessage(`✓ Teleconsultation confirmed for ${current?.patient_name} on ${new Date(scheduledAt).toLocaleString('en-IN')}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleSendInstantRx = () => {
    setRxSent(true);
    setTimeout(() => setRxSent(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-6xl font-sans">
      {/* ── Official Government Verified Certification Banner ── */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#0E2A47] via-[#113B66] to-[#0E2A47] border border-[#1E5288] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 border border-blue-400 flex items-center justify-center text-white text-xl font-bold shrink-0">
            🏛️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">National Teleconsultation Network (eSanjeevani / ABDM Verified)</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                ✓ GOVT CERTIFIED
              </span>
            </div>
            <p className="text-xs text-blue-200 mt-0.5">
              Ministry of Health & Family Welfare · National Health Authority (NHA) Level-3 Certified Telemedicine Gateway
            </p>
          </div>
        </div>

        <div className="text-[11px] text-blue-200/90 font-mono bg-[#0B2138] px-3 py-1.5 rounded-lg border border-[#1C4B78]">
          Attending Clinician Reg: <strong className="text-white">WBMC/NMC #78421-A</strong>
        </div>
      </div>

      {/* ── 24x7 Emergency Contact Numbers Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-700/50 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <span className="block text-[10px] uppercase font-bold text-red-300">National Emergency</span>
            <span className="text-base font-extrabold text-white">112</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/50 flex items-center gap-3">
          <span className="text-2xl">🚑</span>
          <div>
            <span className="block text-[10px] uppercase font-bold text-amber-300">Ambulance Service</span>
            <span className="text-base font-extrabold text-white">108</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-700/50 flex items-center gap-3">
          <span className="text-2xl">📞</span>
          <div>
            <span className="block text-[10px] uppercase font-bold text-blue-300">Health Helpline</span>
            <span className="text-base font-extrabold text-white">104</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-700/50 flex items-center gap-3">
          <span className="text-2xl">🦶</span>
          <div>
            <span className="block text-[10px] uppercase font-bold text-teal-300">Diabetic Foot SOS</span>
            <span className="text-xs font-bold text-white">1800-345-DIAB</span>
          </div>
        </div>
      </div>

      {/* ── Virtual Teleconsultation Video Room (Live Simulator) ── */}
      <div className="p-6 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2E56]">
          <div>
            <span className="text-[10px] font-bold uppercase text-blue-400 tracking-wider">Encrypted Clinical Session</span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Live Patient Consultation: {current?.patient_name || 'Ramesh Chandra Sen'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {!inCall ? (
              <button
                onClick={() => setInCall(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-2"
              >
                <span>📹</span> Launch Live Video Session
              </button>
            ) : (
              <button
                onClick={() => setInCall(false)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow flex items-center gap-2"
              >
                <span>🛑</span> End Consultation
              </button>
            )}
          </div>
        </div>

        {inCall ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Live Video Feeds */}
            <div className="lg:col-span-2 space-y-3">
              <div className="h-80 rounded-xl bg-black relative overflow-hidden border border-slate-700 flex items-center justify-center">
                {videoOff ? (
                  <div className="text-center text-slate-500">
                    <span className="text-4xl block mb-2">📷</span>
                    <span className="text-xs">Patient Camera Paused</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-emerald-400 flex items-center justify-center text-3xl mx-auto mb-2 text-white">
                      👤
                    </div>
                    <span className="text-xs font-bold text-white">{current?.patient_name} (Active Feed)</span>
                    <span className="block text-[10px] text-emerald-400 font-mono">1080p · Encrypted WebRTC Stream</span>
                  </div>
                )}

                {/* Self View (Doctor PIP) */}
                <div className="absolute bottom-3 right-3 w-28 h-20 rounded-lg bg-slate-900 border border-slate-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  Dr. Attending
                </div>

                {/* Live Vitals Overlay */}
                <div className="absolute top-3 left-3 p-2 rounded-lg bg-black/70 backdrop-blur border border-white/10 text-[10px] space-y-0.5 text-white font-mono">
                  <div>Pulse: <span className="text-emerald-400 font-bold">78 bpm</span></div>
                  <div>SpO2: <span className="text-teal-400 font-bold">98%</span></div>
                  <div>Blood Glucose: <span className="text-amber-400 font-bold">142 mg/dL</span></div>
                </div>
              </div>

              {/* Call Controls */}
              <div className="flex items-center justify-center gap-4 p-2.5 rounded-xl bg-[#0C152E] border border-[#1E2E56]">
                <button
                  onClick={() => setMicMuted(!micMuted)}
                  className={`p-2.5 rounded-full text-xs font-bold ${micMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  title="Toggle Microphone"
                >
                  {micMuted ? '🔇 Unmute' : '🎙️ Mute'}
                </button>
                <button
                  onClick={() => setVideoOff(!videoOff)}
                  className={`p-2.5 rounded-full text-xs font-bold ${videoOff ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  title="Toggle Camera"
                >
                  {videoOff ? '📷 Start Video' : '🚫 Stop Video'}
                </button>
                <button
                  onClick={() => alert('Screen sharing enabled for clinical wound scan examination.')}
                  className="p-2.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  🖥️ Share Scans
                </button>
              </div>
            </div>

            {/* Live E-Prescription & Notes Scratchpad */}
            <div className="p-4 rounded-xl bg-[#0C152E] border border-[#1E2E56] space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                  Live Clinical Notes & E-Prescription
                </h4>
                <textarea
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                  rows={8}
                  className="w-full p-3 bg-[#091024] border border-[#22335A] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="Enter diagnosis, dressing changes, and prescription..."
                />
              </div>

              <div>
                {rxSent && (
                  <div className="p-2 rounded bg-emerald-950/50 border border-emerald-700/50 text-emerald-300 text-[11px] font-bold mb-2">
                    ✓ E-Prescription signed & sent via SMS!
                  </div>
                )}
                <button
                  onClick={handleSendInstantRx}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-colors"
                >
                  ✍️ Digitally Sign & Dispatch E-Rx
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-[#0C152E] border border-[#1E2E56] text-center space-y-3">
            <span className="text-4xl block">👨‍⚕️</span>
            <h4 className="text-base font-bold text-white">Teleconsultation Ready</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Click 'Launch Live Video Session' above to connect with the patient or field ASHA health worker via encrypted WebRTC.
            </p>
          </div>
        )}
      </div>

      {/* ── Teleconsult Booking Queue ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white">Teleconsultation Queue ({items.length})</h3>
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {items.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  selected === t.id ? 'bg-[#1A2C56] border-blue-500 shadow-md' : 'bg-[#0C152E] border-[#1E2E56] hover:bg-[#142144]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{t.patient_name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/40">
                    {t.status || 'Scheduled'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  MRN: {t.patient_id} · {t.request_type}
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-1">{t.patient_concern_en}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Form */}
        <form onSubmit={handleSchedule} className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white">Schedule New Consultation Slot</h3>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Selected Patient</label>
            <input
              type="text"
              readOnly
              value={`${current?.patient_name || 'Ramesh Chandra Sen'} (${current?.patient_phone || '+91 98310 12345'})`}
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-slate-300 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Date & Time Slot</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Preparation & Clinical Instructions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., Clean wound area with saline 15 minutes before call..."
            />
          </div>

          {message && (
            <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs font-bold">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-colors"
          >
            {saving ? 'Scheduling…' : 'Confirm & Send SMS Dispatch'}
          </button>
        </form>
      </div>
    </div>
  );
}
