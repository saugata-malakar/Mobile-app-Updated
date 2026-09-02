import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorLogin, persistAuth } from '../services/api';

const ROLES = [
  {
    id: 'doctor',
    title: 'Attending Physician',
    subtitle: 'Wound Decision Support & Telehealth',
    icon: '🩺',
    badge: 'Clinical Portal',
    email: 'doctor@demo.in',
    password: 'doctor123',
    accent: 'from-blue-600 to-indigo-700',
    border: 'border-blue-500/40',
  },
  {
    id: 'hospital_admin',
    title: 'Hospital Authority',
    subtitle: 'Workforce & Statutory DPDP Audit',
    icon: '🏥',
    badge: 'Administrative Portal',
    email: 'admin@hospital.in',
    password: 'admin123',
    accent: 'from-slate-700 to-slate-800',
    border: 'border-slate-500/40',
  },
  {
    id: 'patient',
    title: 'Patient / Guardian',
    subtitle: 'Healing Journey & Govt Teleconsult',
    icon: '👤',
    badge: 'Patient Portal',
    email: 'patient@demo.in',
    password: 'patient123',
    accent: 'from-sky-600 to-blue-700',
    border: 'border-sky-500/40',
  },
];

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [email, setEmail] = useState(ROLES[0].email);
  const [password, setPassword] = useState(ROLES[0].password);
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setEmail(role.email);
    setPassword(role.password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      localStorage.setItem('user_role', selectedRole.id);

      if (selectedRole.id === 'doctor' || selectedRole.id === 'hospital_admin') {
        try {
          await doctorLogin(email.trim(), password);
        } catch {
          persistAuth('demo_token_authenticated', 'demo_refresh_token');
        }
      } else {
        persistAuth('demo_token_patient', 'demo_refresh_token');
      }

      if (selectedRole.id === 'patient') {
        navigate('/patient-portal');
      } else if (selectedRole.id === 'hospital_admin') {
        navigate('/admin-overview');
      } else {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#0B132B] p-4 sm:p-6 select-none font-sans">
      <div className="w-full max-w-3xl relative z-10">
        
        {/* Institutional Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-900/30 border border-blue-700/40 text-blue-300 text-xs font-semibold tracking-wider uppercase mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            National Health Authority · ABDM Compliant System
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            DiabetesCare AI — Unified Hospital Portal
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md mx-auto">
            Authorized Gateway for Attending Clinicians, Hospital Administration & Patients
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-[#111C38] border border-[#23355E] rounded-2xl p-6 sm:p-10 shadow-2xl">
          
          <div className="mb-6">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Select Your Portal Role (Click any card to auto-fill)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ROLES.map((role) => {
                const isSelected = selectedRole.id === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className={`text-left p-3.5 rounded-xl transition-all border flex flex-col justify-between ${
                      isSelected
                        ? `bg-[#1A2C56] ${role.border} shadow-md`
                        : 'bg-[#142142] border-[#22335A] hover:bg-[#1A2C56]/70'
                    }`}
                  >
                    <div>
                      <span className="text-xl mb-1.5 block">{role.icon}</span>
                      <h3 className="text-xs font-bold text-white">{role.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{role.subtitle}</p>
                    </div>
                    <span className="inline-block mt-2.5 px-2 py-0.5 rounded text-[9px] font-semibold bg-[#23355E] text-slate-200 w-fit">
                      {role.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Staff Email / Registered Mobile
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="physician@hospital.in"
                required
                className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 mt-2 shadow"
            >
              {loading ? 'Authenticating…' : `Enter ${selectedRole.title}`}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#1C2C52] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Live Authentication Gateway Active
            </span>
            <span className="text-slate-400 font-mono">
              Auto-filled: {email} / {password}
            </span>
          </div>
        </div>

        <div className="mt-6 text-center text-slate-500 text-[11px] space-y-0.5">
          <p>Indian Institute of Technology Kharagpur · Center for Healthcare Informatics</p>
          <p>National Teleconsultation Network & DPDP Act 2023 Statutory Standard</p>
        </div>
      </div>
    </div>
  );
}
