import React from 'react';
import { Link } from 'react-router-dom';

export default function PatientPortal() {
  return (
    <div className="space-y-6 max-w-5xl font-sans">
      {/* ── Reassuring Patient Welcome Banner ── */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0C2744] via-[#103E6D] to-[#0C2744] border border-[#1D5188] shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Welcome, Ramesh Chandra Sen</span>
            <h2 className="text-2xl font-bold text-white mt-1">My Wound Healing Journey</h2>
            <p className="text-xs text-blue-200 mt-0.5">
              MRN: PAT_KGP_01 · Left Plantar Great Toe Ulcer · Assigned Doctor: Dr. Clinical Specialist
            </p>
          </div>
          <Link
            to="/teleconsults"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center gap-2"
          >
            <span>📹</span> Join Doctor Teleconsult
          </Link>
        </div>
      </div>

      {/* ── Emergency SOS Hotline ── */}
      <div className="p-4 rounded-xl bg-red-950/40 border border-red-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🚨</span>
          <div>
            <h4 className="text-sm font-bold text-red-200">Experiencing severe pain, spreading redness, or high fever?</h4>
            <p className="text-xs text-red-300/80">Call 24x7 National Medical Emergency or Diabetic Foot Helpline immediately.</p>
          </div>
        </div>
        <a
          href="tel:112"
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs tracking-wider shadow"
        >
          CALL 112 / 108 SOS
        </a>
      </div>

      {/* ── Healing Progress Gauge & Next Appointment ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl text-center space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Overall Healing Progress</span>
          <div className="w-24 h-24 rounded-full border-4 border-emerald-500 flex items-center justify-center mx-auto text-2xl font-extrabold text-emerald-400">
            68%
          </div>
          <p className="text-xs text-emerald-300 font-semibold">Area reduced from 5.2 cm² to 2.57 cm²</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Next Dressing Change</span>
          <h3 className="text-xl font-bold text-white mt-1">Tomorrow, 10:00 AM</h3>
          <p className="text-xs text-slate-400">ASHA Worker: Manasi Roy (+91 97321 55432)</p>
          <div className="pt-2">
            <span className="px-2 py-1 rounded bg-blue-900/40 text-blue-300 text-[10px] font-bold">
              Saline Clean + Hydrocolloid Foam
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Doctor's Care Advice</span>
          <p className="text-xs text-slate-300 leading-relaxed">
            • Avoid walking barefoot at all times.<br/>
            • Take Amoxicillin-Clavulanate 625mg twice daily after meals.<br/>
            • Maintain morning fasting blood sugar &lt; 130 mg/dL.
          </p>
        </div>
      </div>

      {/* ── Active Prescriptions ── */}
      <div className="p-6 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Digital Prescriptions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-[#0C152E] border border-[#1E2E56] space-y-1">
            <span className="text-xs font-bold text-white">Amoxicillin-Clavulanate (Augmentin)</span>
            <span className="block text-[11px] text-blue-400 font-mono">625 mg · 1 Tablet Twice Daily (BID) · 7 Days</span>
            <p className="text-[10px] text-slate-400">Take after food. Complete full antibacterial course.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0C152E] border border-[#1E2E56] space-y-1">
            <span className="text-xs font-bold text-white">Hydrocolloid Barrier Foam Dressing</span>
            <span className="block text-[11px] text-teal-400 font-mono">Topical Application · Change every 48 hours</span>
            <p className="text-[10px] text-slate-400">Irrigate wound with sterile normal saline before application.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
