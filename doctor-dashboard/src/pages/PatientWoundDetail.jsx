import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { fetchWoundDetail } from '../services/doctorService';

const MOCK_VISIT_HISTORY = [
  { visit: 'Visit 1', date: '10 Aug', area: 5.20, length: 32.4, width: 20.1, perim: 86.4, wagner: 2, granulation: 45, slough: 35, necrotic: 20 },
  { visit: 'Visit 2', date: '18 Aug', area: 4.12, length: 28.6, width: 18.2, perim: 76.0, wagner: 2, granulation: 58, slough: 30, necrotic: 12 },
  { visit: 'Visit 3', date: '27 Aug', area: 2.57, length: 24.1, width: 13.8, perim: 62.4, wagner: 1, granulation: 68, slough: 22, necrotic: 10 },
];

export default function PatientWoundDetail() {
  const { patientId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(MOCK_VISIT_HISTORY[2]);
  
  // High contrast view toggle
  const [viewOverlay, setViewOverlay] = useState(true);

  // Authoritative override state
  const [overrideLength, setOverrideLength] = useState('');
  const [overrideWidth, setOverrideWidth] = useState('');
  const [overrideArea, setOverrideArea] = useState('');
  const [overrideSaved, setOverrideSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWoundDetail(patientId || 'PAT_KGP_01');
        setData(res);
      } catch {
        // demo fallback
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  const handleSaveOverride = (e) => {
    e.preventDefault();
    setOverrideSaved(true);
    setTimeout(() => setOverrideSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-6xl font-sans">
      {/* ── Patient Clinical Header Card ── */}
      <div className="p-6 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Ramesh Chandra Sen</h2>
              <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 text-xs font-mono font-bold border border-blue-700/40">
                ABHA: 91-8421-9982-1044
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              58 yrs · Male · Type 2 Diabetes (12.5 yrs) · Paschim Medinipur, West Bengal
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="px-3 py-1.5 rounded-lg bg-amber-950/50 text-amber-300 border border-amber-700/50">
              HbA1c: 8.4% (Uncontrolled)
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-blue-950/50 text-blue-300 border border-blue-700/50">
              BP: 135/85 mmHg
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-purple-950/50 text-purple-300 border border-purple-700/50">
              Wagner Grade 2 (Deep Ulcer)
            </span>
          </div>
        </div>
      </div>

      {/* ── Interactive Visual Inspection & Tissue Breakdown Window ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Wound Canvas Overlay Visualizer */}
        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Computer Vision Wound Segmentation</h3>
            <div className="flex gap-1.5 bg-[#091024] p-1 rounded-lg border border-[#22335A]">
              <button
                onClick={() => setViewOverlay(true)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  viewOverlay ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                AI Segmentation Overlay
              </button>
              <button
                onClick={() => setViewOverlay(false)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  !viewOverlay ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Original Photo
              </button>
            </div>
          </div>

          {/* Canvas Simulation */}
          <div className="h-72 rounded-xl bg-slate-950 relative overflow-hidden border border-[#23355E] flex items-center justify-center">
            {/* Simulated wound anatomy */}
            <div className="w-48 h-36 rounded-full bg-gradient-to-r from-red-800 via-rose-900 to-amber-900 shadow-inner relative flex items-center justify-center">
              {viewOverlay && (
                <>
                  {/* Contour highlight */}
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-pulse"></div>
                  {/* Calibrant marker ring */}
                  <div className="absolute -top-6 -left-6 w-12 h-12 rounded-full border-2 border-cyan-400 bg-cyan-900/40 flex items-center justify-center text-[8px] text-cyan-300 font-mono">
                    20mm
                  </div>
                  {/* Measurement Badge */}
                  <div className="p-2 rounded bg-black/80 border border-emerald-500/50 text-[10px] text-white font-mono space-y-0.5 shadow-lg">
                    <div className="text-emerald-400 font-bold">Area: {selectedVisit.area} cm²</div>
                    <div>L: {selectedVisit.length} mm | W: {selectedVisit.width} mm</div>
                    <div className="text-cyan-300">Scale: 18.4 px/mm</div>
                  </div>
                </>
              )}
            </div>

            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-[10px] text-slate-300 font-mono">
              Site: Left Plantar Great Toe · {selectedVisit.date}
            </div>
          </div>

          {/* Granular Tissue Breakdown */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Tissue Classification Breakdown</span>
            <div className="h-4 rounded-full overflow-hidden flex shadow-inner bg-slate-900">
              <div style={{ width: `${selectedVisit.granulation}%` }} className="bg-rose-600" title={`Granulation: ${selectedVisit.granulation}%`}></div>
              <div style={{ width: `${selectedVisit.slough}%` }} className="bg-amber-400" title={`Slough: ${selectedVisit.slough}%`}></div>
              <div style={{ width: `${selectedVisit.necrotic}%` }} className="bg-slate-950 border-r border-slate-700" title={`Necrotic: ${selectedVisit.necrotic}%`}></div>
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-300 pt-0.5">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-600"></span> Granulation ({selectedVisit.granulation}%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Slough ({selectedVisit.slough}%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-800 border border-slate-600"></span> Necrotic ({selectedVisit.necrotic}%)</span>
            </div>
          </div>
        </div>

        {/* Right: Longitudinal Trajectory Multi-Metric Recharts Graph */}
        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Longitudinal Healing Progression</h3>
              <p className="text-[11px] text-slate-400">Surface area (cm²) & Feret dimensions (mm) across visits</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 text-[10px] font-bold border border-emerald-700/40">
              -50.6% Total Area Reduction
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_VISIT_HISTORY}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2B52" />
                <XAxis dataKey="visit" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#091024', borderColor: '#23355E', borderRadius: '8px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px', color: '#94A3B8' }} />
                <Line type="monotone" dataKey="area" stroke="#3B82F6" strokeWidth={2.5} name="Area (cm²)" activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="length" stroke="#10B981" strokeWidth={2} name="Length (mm)" />
                <Line type="monotone" dataKey="width" stroke="#F59E0B" strokeWidth={2} name="Width (mm)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Visit Select Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1D2B52]">
            {MOCK_VISIT_HISTORY.map((v) => (
              <button
                key={v.visit}
                onClick={() => setSelectedVisit(v)}
                className={`p-2 rounded-lg text-left border transition-all ${
                  selectedVisit.visit === v.visit
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                    : 'bg-[#0C152E] text-slate-300 border-[#1E2E56] hover:bg-[#142144]'
                }`}
              >
                <div className="font-bold text-xs">{v.visit}</div>
                <div className="text-[10px] opacity-80">{v.date} · {v.area} cm²</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 10-Point Neuropathy Foot Sensation Map & Clinical Recommendations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monofilament Map */}
        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">10-Point Monofilament Map</h3>
            <span className="text-[10px] font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-700/50">
              4/10 (High Sensory Loss)
            </span>
          </div>
          <div className="h-44 rounded-xl bg-[#0C152E] border border-[#1E2E56] flex items-center justify-center p-3 relative">
            {/* Diagram of foot */}
            <div className="w-24 h-36 rounded-t-full rounded-b-3xl border-2 border-slate-600 relative bg-slate-900/60">
              {/* Sensory dots */}
              <div className="absolute top-2 left-6 w-3 h-3 rounded-full bg-red-500" title="Great Toe: Loss of Sensation"></div>
              <div className="absolute top-4 left-14 w-3 h-3 rounded-full bg-red-500" title="3rd Toe: Loss of Sensation"></div>
              <div className="absolute top-8 left-18 w-3 h-3 rounded-full bg-emerald-500" title="5th Toe: Intact"></div>
              <div className="absolute top-14 left-4 w-3 h-3 rounded-full bg-red-500" title="1st Metatarsal: Loss of Sensation"></div>
              <div className="absolute top-16 left-12 w-3 h-3 rounded-full bg-red-500" title="3rd Metatarsal: Loss of Sensation"></div>
              <div className="absolute top-18 left-18 w-3 h-3 rounded-full bg-emerald-500" title="5th Metatarsal: Intact"></div>
              <div className="absolute bottom-4 left-10 w-3 h-3 rounded-full bg-emerald-500" title="Heel: Intact"></div>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal Sensation</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Insensate Loss</span>
          </div>
        </div>

        {/* Clinical Decision Support Recommendations */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">AI Clinical Care Plan Advisory</h3>
            <p className="text-[11px] text-slate-400">Standardized protocol based on Wagner Grade 2 & $8.4\%$ HbA1c</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#0C152E] border border-[#1E2E56] space-y-1">
              <span className="font-bold text-blue-400 block">🩹 Advanced Dressing Protocol</span>
              <p className="text-slate-300 text-[11px]">Apply non-adherent foam or hydrocolloid dressing with gentle saline debridement every 48 hours.</p>
            </div>
            <div className="p-3 rounded-xl bg-[#0C152E] border border-[#1E2E56] space-y-1">
              <span className="font-bold text-emerald-400 block">👟 Offloading Footwear Guidance</span>
              <p className="text-slate-300 text-[11px]">Strict pressure relief with custom molded rocker-bottom therapeutic footwear.</p>
            </div>
            <div className="p-3 rounded-xl bg-[#0C152E] border border-[#1E2E56] space-y-1">
              <span className="font-bold text-amber-400 block">🩸 Glycemic Escalation</span>
              <p className="text-slate-300 text-[11px]">Escalate basal insulin regimen to achieve target fasting plasma glucose &lt; 130 mg/dL.</p>
            </div>
            <div className="p-3 rounded-xl bg-[#0C152E] border border-[#1E2E56] space-y-1">
              <span className="font-bold text-purple-400 block">📹 Teleconsultation Interval</span>
              <p className="text-slate-300 text-[11px]">Weekly virtual check-in with assigned field ASHA worker (ASHA_WB_0042).</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              to="/prescriptions/PAT_KGP_01"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-colors"
            >
              ✍️ Write Digital Prescription
            </Link>
            <Link
              to="/teleconsults"
              className="px-4 py-2 rounded-lg bg-[#1D2B52] hover:bg-[#253966] text-slate-200 font-bold text-xs border border-[#2A3F75] transition-colors"
            >
              📹 Book Follow-up Call
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
