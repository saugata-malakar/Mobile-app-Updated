import React, { useState } from 'react';

const DEPARTMENTS = [
  'Department of Diabetology & Metabolic Disorders',
  'Department of Podiatric Surgery & Diabetic Foot Clinic',
  'Department of Vascular & Endovascular Surgery',
  'Department of Community Medicine & Rural Outreach',
  'Department of General Surgery & Wound Healing Center',
  'Department of Endocrinology & Clinical Nutrition',
];

const HOSPITAL_NODES = [
  'Midnapore Medical College & Hospital (Apex Hub, West Bengal)',
  'Kharagpur Sub-Divisional Hospital (Telehealth Node 1)',
  'Jhargram Super Specialty Hospital (Telehealth Node 2)',
  'Tamluk District Hospital (Telehealth Node 3)',
  'Bankura Sammilani Medical College & Hospital (Affiliated Node)',
];

export default function SettingsPage() {
  const [name, setName] = useState('Dr. Clinical Specialist');
  const [specialisation, setSpecialisation] = useState('Diabetology & Vascular Wound Care');
  const [regNumber, setRegNumber] = useState('WBMC/NMC #78421-A');
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);
  const [selectedHospital, setSelectedHospital] = useState(HOSPITAL_NODES[0]);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl font-sans">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">System & Practice Management</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">Hospital & Practitioner Settings</h2>
        <p className="text-slate-400 text-xs mt-0.5">
          Configure clinical department affiliation, teleconsultation nodes, and automated escalation parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-[#111C38] border border-[#23355E] shadow-xl space-y-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hospital & Department Affiliation</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
              Clinical Department (Switch Active Department)
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} className="bg-[#0B132B] text-white">{d}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
              Hospital Branch / Telemedicine Node
            </label>
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {HOSPITAL_NODES.map((h) => (
                <option key={h} value={h} className="bg-[#0B132B] text-white">{h}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Practitioner Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Medical Council Registration #</label>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">Clinical Specialisation</label>
            <input
              type="text"
              value={specialisation}
              onChange={(e) => setSpecialisation(e.target.value)}
              className="w-full px-3 py-2 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#1D2B52] space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Clinical Escalation & Dispatch</h3>
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-[#091024] border-[#22335A]"
              />
              <span className="text-xs text-slate-300">Email dispatch for RED grade urgent ulcer progression (&gt;10% area expansion)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={smsAlerts}
                onChange={(e) => setSmsAlerts(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-[#091024] border-[#22335A]"
              />
              <span className="text-xs text-slate-300">Instant SMS broadcast to on-call attending podiatrist</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoEscalate}
                onChange={(e) => setAutoEscalate(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-[#091024] border-[#22335A]"
              />
              <span className="text-xs text-slate-300">Automated triage routing to Vascular Surgery on Wagner Grade 3+</span>
            </label>
          </div>
        </div>

        {saved && (
          <div className="p-2.5 bg-emerald-950/40 border border-emerald-700/50 rounded-md text-emerald-300 text-xs font-semibold">
            ✓ Department configuration and institutional affiliation saved successfully.
          </div>
        )}

        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-colors"
        >
          Save Practice Profile & Department Affiliation
        </button>
      </form>
    </div>
  );
}
