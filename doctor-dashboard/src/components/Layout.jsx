import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAuth } from '../services/api';

export default function Layout({ doctor, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentRole = localStorage.getItem('user_role') || 'doctor';

  const logout = () => {
    clearAuth();
    localStorage.removeItem('user_role');
    navigate('/login');
  };

  // Dynamic Navigation per Role
  let navItems = [];
  let roleTitle = 'Attending Physician';
  let roleBadge = 'Diabetology Lead';

  if (currentRole === 'hospital_admin') {
    roleTitle = 'Hospital Administration';
    roleBadge = 'Statutory Oversight';
    navItems = [
      { to: '/admin-overview', label: 'Hospital Operations', icon: '🏥' },
      { to: '/department', label: 'Department Triage', icon: '⚡' },
      { to: '/asha', label: 'ASHA Field Workforce', icon: '👩‍⚕️' },
      { to: '/dpdp', label: 'DPDP Statutory Audit', icon: '🛡️' },
      { to: '/analytics', label: 'Informatics & KPIs', icon: '📊' },
      { to: '/settings', label: 'Hospital Settings', icon: '⚙️' },
    ];
  } else if (currentRole === 'patient') {
    roleTitle = 'Ramesh Chandra Sen';
    roleBadge = 'MRN: PAT_KGP_01';
    navItems = [
      { to: '/patient-portal', label: 'My Healing Journey', icon: '🩹' },
      { to: '/teleconsults', label: 'Join Govt Teleconsult', icon: '📹' },
      { to: '/patients/PAT_KGP_01', label: 'Full Wound Trajectory', icon: '📈' },
      { to: '/settings', label: 'My Care Preferences', icon: '⚙️' },
    ];
  } else {
    // Doctor (default)
    navItems = [
      { to: '/', label: 'Clinical Triage Queue', icon: '⚡' },
      { to: '/patients/PAT_KGP_01', label: 'Wound Trajectory & Overrides', icon: '🩹' },
      { to: '/teleconsults', label: 'National Teleconsult (eSanjeevani)', icon: '📹' },
      { to: '/department', label: 'Department Registry', icon: '🏥' },
      { to: '/analytics', label: 'Informatics & AI Models', icon: '📊' },
      { to: '/asha', label: 'Field Health Workforce', icon: '👩‍⚕️' },
      { to: '/dpdp', label: 'DPDP Compliance Audit', icon: '🛡️' },
      { to: '/settings', label: 'Practitioner Settings', icon: '⚙️' },
    ];
  }

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } bg-[#0E1734] border-r border-[#1D2B52] transition-all duration-200 flex flex-col justify-between fixed inset-y-0 left-0 z-30 shadow-lg`}
      >
        <div>
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-3.5 border-b border-[#1D2B52]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                DC
              </div>
              {!collapsed && (
                <div>
                  <h1 className="font-bold text-xs text-white leading-tight">
                    DiabetesCare AI
                  </h1>
                  <span className="text-[10px] text-blue-400 font-medium tracking-wide uppercase">
                    {currentRole === 'patient' ? 'Patient Health Portal' : currentRole === 'hospital_admin' ? 'Hospital Admin Suite' : 'Clinical Workstation'}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#1A2C56] transition-colors text-xs"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '▶' : '◀'}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#17244B]'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-2.5 border-t border-[#1D2B52] bg-[#0A122A]">
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#142144] border border-[#23355E]">
            <div className="w-7 h-7 rounded bg-blue-700 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              {currentRole === 'patient' ? 'PT' : currentRole === 'hospital_admin' ? 'HA' : 'DR'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-white truncate">{roleTitle}</p>
                <p className="text-[10px] text-slate-400 truncate">{roleBadge}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className="w-full mt-2 py-1.5 px-2 rounded-md bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-800 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>🚪</span>
            {!collapsed && <span>Switch Portal / Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Top Header */}
        <header className="h-14 bg-[#0E1734] border-b border-[#1D2B52] px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 w-72">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-500 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search MRN, records, or emergency helpline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1 bg-[#091024] border border-[#22335A] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-950/50 border border-blue-700/50 text-blue-300 text-[11px]">
              <span>🏛️</span>
              <span className="font-semibold">NHA ABDM Certified</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-700/40 text-emerald-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              OpenCV Ingestion Active
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-6 overflow-y-auto bg-[#0B132B]">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-2.5 px-6 text-center text-[11px] text-slate-500 border-t border-[#1D2B52] bg-[#0E1734]">
          National Telemedicine & Ulcer Segmentation Workstation · IIT Kharagpur · 24x7 Emergency: Dial 112 / 108 / 104
        </footer>
      </div>
    </div>
  );
}
