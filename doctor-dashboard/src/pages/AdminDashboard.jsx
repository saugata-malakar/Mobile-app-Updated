import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  return (
    <div className="space-y-6 max-w-6xl font-sans">
      <div className="p-6 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Hospital Administration & Governance</span>
          <h2 className="text-2xl font-bold text-white mt-1">Midnapore Medical College Workstation</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Institutional oversight of diabetic ulcer triage, ASHA community workforce, and statutory DPDP compliance.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dpdp" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow">
            🛡️ DPDP Audit Trail
          </Link>
          <Link to="/asha" className="px-4 py-2 rounded-lg bg-[#1D2B52] hover:bg-[#253966] text-slate-200 font-bold text-xs border border-[#2A3F75]">
            👩‍⚕️ ASHA Workforce
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Enrolled Ulcers</span>
          <h3 className="text-2xl font-bold text-white mt-1">147 Cases</h3>
          <p className="text-[10px] text-emerald-400 mt-0.5">Across 4 South Bengal blocks</p>
        </div>
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Active ASHA Workforce</span>
          <h3 className="text-2xl font-bold text-white mt-1">12 Workers</h3>
          <p className="text-[10px] text-blue-400 mt-0.5">135 field visits logged</p>
        </div>
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase">DPDP Consent Record</span>
          <h3 className="text-2xl font-bold text-emerald-400 mt-1">100% Compliant</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Zero unconsented ingests</p>
        </div>
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Telemedicine Utilization</span>
          <h3 className="text-2xl font-bold text-indigo-400 mt-1">89.2%</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Avg turnaround 3.4 hrs</p>
        </div>
      </div>
    </div>
  );
}
