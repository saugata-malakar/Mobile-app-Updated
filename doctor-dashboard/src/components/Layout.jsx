import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAuth, getStoredUser } from '../services/api';

export default function Layout({ doctor, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const storedUser = getStoredUser();
  const currentRole = (storedUser?.role || localStorage.getItem('user_role') || 'doctor').toLowerCase();
  const workerType = storedUser?.worker_type || localStorage.getItem('worker_type') || '';
  const displayName = storedUser?.full_name || storedUser?.name || doctor?.name;

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  let navItems;
  let roleTitle = 'Attending Physician';
  let roleBadge = 'Diabetology Lead';

  if (currentRole === 'admin' || currentRole === 'hospital_admin') {
    roleTitle = 'System Administrator';
    roleBadge = 'Full Platform Oversight';
    navItems = [
      { to: '/admin-overview', label: 'Admin Control Center', icon: '⚙️' },
      { to: '/admin/users', label: 'User Management', icon: '👥' },
      { to: '/admin/submissions', label: 'Submissions & Photos', icon: '🖼️' },
      { to: '/admin/payments', label: 'Payments & ₹ Ledger', icon: '💰' },
      { to: '/dpdp', label: 'DPDP Audit Logs', icon: '🛡️' },
      { to: '/asha', label: 'Field Workforce Metrics', icon: '👩‍⚕️' },
      { to: '/settings', label: 'Settings', icon: '🔧' },
    ];
  } else if (currentRole === 'moderator') {
    roleTitle = 'QA Moderator';
    roleBadge = '₹20 / Approved Record';
    navItems = [
      { to: '/moderator', label: 'Moderator Review Queue', icon: '🔍' },
      { to: '/settings', label: 'Profile & Earnings', icon: '💰' },
    ];
  } else if (currentRole === 'field_worker') {
    roleTitle = `${workerType || 'ASHA'} Field Collector`;
    roleBadge = '₹50 / Accepted Record';
    navItems = [
      { to: '/field-collector', label: 'Data Collection Portal', icon: '📋' },
      { to: '/settings', label: 'Profile & Earnings', icon: '💰' },
    ];
  } else if (currentRole === 'patient') {
    roleTitle = 'Ramesh Chandra Sen';
    roleBadge = 'MRN: PAT_KGP_01';
    navItems = [
      { to: '/patient-portal', label: 'My Healing Journey', icon: '🩹' },
      { to: '/teleconsults', label: 'Join Govt Teleconsult', icon: '📹' },
      { to: '/mobile-simulator', label: 'Mobile Camera Capture Flow', icon: '📱' },
      { to: '/patients/PAT_KGP_01', label: 'Full Wound Trajectory', icon: '📈' },
      { to: '/settings', label: 'My Care Preferences', icon: '⚙️' },
    ];
  } else {
    // Doctor (default)
    navItems = [
      { to: '/', label: 'Clinical Triage Hub', icon: '⚡' },
      { to: '/doctor/collect', label: 'Submit Patient Record (₹80)', icon: '🩺' },
      { to: '/doctor/validate-queue', label: 'Validate ASHA Queue (₹30)', icon: '✅' },
      { to: '/patients/PAT_KGP_01', label: 'Wound Trajectory & Overrides', icon: '🩹' },
      { to: '/teleconsults', label: 'National Teleconsult (eSanjeevani)', icon: '📹' },
      { to: '/mobile-simulator', label: 'Mobile Field App Simulator', icon: '📱' },
      { to: '/department', label: 'Department Registry', icon: '🏥' },
      { to: '/analytics', label: 'Informatics & AI Models', icon: '📊' },
      { to: '/dpdp', label: 'DPDP Compliance Audit', icon: '🛡️' },
      { to: '/settings', label: 'Practitioner Settings', icon: '⚙️' },
    ];
  }

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } bg-[#0E1736] border-r border-[#1D2B52] transition-all duration-200 flex flex-col justify-between shrink-0 select-none z-20`}
      >
        <div>
          <div className="p-4 border-b border-[#1D2B52] flex items-center justify-between">
            {!collapsed ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <h1 className="font-bold text-sm tracking-tight text-white">DiabetesCare AI</h1>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">IIT Kharagpur & MMCH</p>
              </div>
            ) : (
              <span className="mx-auto font-black text-blue-400 text-lg">DC</span>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#1A284D] text-xs"
              title="Toggle sidebar"
            >
              {collapsed ? '▶' : '◀'}
            </button>
          </div>

          <nav className="p-2 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-300 hover:bg-[#162347] hover:text-white'
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

        {/* User Card & Logout */}
        <div className="p-3 border-t border-[#1D2B52] bg-[#0A1128]">
          {!collapsed ? (
            <div>
              <div className="mb-2.5">
                <p className="text-xs font-bold text-white truncate">{displayName || roleTitle}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  {storedUser?.specialization || roleBadge}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full py-1.5 px-2.5 rounded bg-[#162347] hover:bg-rose-900/40 hover:text-rose-300 text-slate-300 font-semibold text-xs border border-[#23355E] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>🚪</span> Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="w-full py-2 text-slate-400 hover:text-rose-300 text-sm flex justify-center"
              title="Sign Out"
            >
              🚪
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-[#0E1736] border-b border-[#1D2B52] px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-[#16254A] border border-[#253966] text-blue-300 text-xs font-semibold">
              {roleTitle}
            </span>
            <span className="text-slate-500 text-xs hidden sm:inline">|</span>
            <span className="text-slate-400 text-xs hidden sm:inline">
              Midnapore Apex Hub · {displayName || 'Active Session'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {currentRole === 'doctor' && (
              <Link
                to="/doctor/collect"
                className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 border border-blue-600/50 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <span>🩺</span> Submit Record (₹80)
              </Link>
            )}
            {(currentRole === 'admin' || currentRole === 'hospital_admin') && (
              <Link
                to="/admin/submissions"
                className="px-3 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/35 text-amber-300 border border-amber-600/50 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <span>🖼️</span> Inspect Submissions
              </Link>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="hidden md:inline">FastAPI Connected</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0B132B]">
          {children}
        </main>
      </div>
    </div>
  );
}
