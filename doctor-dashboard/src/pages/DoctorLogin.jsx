import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  autoDetectBackend,
  getApiBaseUrl,
  loginUser,
  persistUserSession,
  pingBackendHealth,
  registerUser,
  setApiBaseUrl,
} from '../services/api';

const ROLES = [
  {
    id: 'doctor',
    title: 'Doctor',
    subtitle: 'Direct collection (₹80) & ASHA validation (₹30)',
    icon: '🩺',
    badge: 'Clinical Portal',
    demoIdentifier: 'doctor@demo.in',
    demoPassword: 'doctor123',
    demoLabel: 'Doctor Demo',
    border: 'border-blue-500/60',
    route: '/',
  },
  {
    id: 'field_worker',
    title: 'ASHA / ICDS / CHO',
    subtitle: 'Field data collection & 3-photo upload (₹50)',
    icon: '📋',
    badge: 'Field Collector',
    demoIdentifier: 'asha@demo.in',
    demoPassword: 'asha123',
    demoLabel: 'ASHA Demo',
    border: 'border-teal-500/60',
    route: '/field-collector',
  },
  {
    id: 'moderator',
    title: 'Moderator',
    subtitle: 'Verify ASHA submissions & photos (₹20)',
    icon: '🔍',
    badge: 'QA Review Portal',
    demoIdentifier: 'moderator@demo.in',
    demoPassword: 'mod123',
    demoLabel: 'Moderator Demo',
    border: 'border-violet-500/60',
    route: '/moderator',
  },
  {
    id: 'admin',
    title: 'Admin',
    subtitle: 'Full system, users, approvals & ₹ payouts',
    icon: '⚙️',
    badge: 'Admin Control',
    demoIdentifier: 'admin@hospital.in',
    demoPassword: 'admin123',
    demoLabel: 'Admin Demo',
    border: 'border-amber-500/60',
    route: '/admin-overview',
  },
  {
    id: 'patient',
    title: 'Patient',
    subtitle: 'Healing journey, wound history & teleconsult',
    icon: '🩹',
    badge: 'Patient Portal',
    demoIdentifier: 'patient@demo.in',
    demoPassword: 'patient123',
    demoLabel: 'Patient Demo',
    border: 'border-sky-500/60',
    route: '/patient-portal',
  },
];

const QUICK_DEMOS = [
  { label: '🩺 Doctor', role: 'doctor', identifier: 'doctor@demo.in', password: 'doctor123', name: 'Dr. Clinical Specialist' },
  { label: '📋 ASHA', role: 'field_worker', worker_type: 'ASHA', identifier: 'asha@demo.in', password: 'asha123', name: 'Manasi Roy (ASHA)' },
  { label: '📋 ICDS', role: 'field_worker', worker_type: 'ICDS', identifier: 'icds@demo.in', password: 'icds123', name: 'ICDS Worker Demo' },
  { label: '📋 CHO', role: 'field_worker', worker_type: 'CHO', identifier: 'cho@demo.in', password: 'cho123', name: 'CHO Officer Demo' },
  { label: '🔍 Moderator', role: 'moderator', identifier: 'moderator@demo.in', password: 'mod123', name: 'QA Moderator' },
  { label: '⚙️ Admin', role: 'admin', identifier: 'admin@hospital.in', password: 'admin123', name: 'System Admin' },
  { label: '🩹 Patient', role: 'patient', identifier: 'patient@demo.in', password: 'patient123', name: 'Ramesh Chandra Sen' },
];

function routeForRole(role) {
  switch (String(role || '').toLowerCase()) {
    case 'admin':
    case 'hospital_admin':
      return '/admin-overview';
    case 'moderator':
      return '/moderator';
    case 'field_worker':
      return '/field-collector';
    case 'patient':
      return '/patient-portal';
    default:
      return '/';
  }
}

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);

  // Login form state
  const [identifier, setIdentifier] = useState(ROLES[0].demoIdentifier);
  const [password, setPassword] = useState(ROLES[0].demoPassword);

  // Register form state
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [workerType, setWorkerType] = useState('ASHA');
  const [district, setDistrict] = useState('Paschim Medinipur');
  const [specialization, setSpecialization] = useState('Diabetology & Vascular Wound Care');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingNotice, setPendingNotice] = useState(null);
  const [backendStatus, setBackendStatus] = useState({ checked: false, connected: false, url: getApiBaseUrl() });
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverInput, setServerInput] = useState(getApiBaseUrl() || 'http://localhost:8000');

  useEffect(() => {
    let cancelled = false;
    autoDetectBackend().then((res) => {
      if (!cancelled) {
        setBackendStatus({ checked: true, connected: res.connected, url: res.url });
        if (res.url && !getApiBaseUrl()) setServerInput(res.url);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleSaveServerUrl = async (urlVal) => {
    const clean = setApiBaseUrl(urlVal);
    setServerInput(clean || 'http://localhost:8000');
    const ok = await pingBackendHealth(clean);
    setBackendStatus({ checked: true, connected: ok, url: clean || window.location.origin });
    if (ok) setShowServerConfig(false);
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setErrorMsg('');
    if (mode === 'login') {
      setIdentifier(role.demoIdentifier);
      setPassword(role.demoPassword);
    }
  };

  const performLogin = async (loginId, loginPass, roleHint, fallbackDemo = null) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await loginUser(loginId, loginPass, roleHint);
      const effectiveRole = data?.user?.role || data?.role || roleHint;
      navigate(routeForRole(effectiveRole));
    } catch (err) {
      if (!err?.response && fallbackDemo) {
        // Offline / static preview fallback for quick demos
        persistUserSession({
          user_id: `${fallbackDemo.role.toUpperCase()}_DEMO_01`,
          role: fallbackDemo.role,
          full_name: fallbackDemo.name,
          worker_type: fallbackDemo.worker_type || '',
          email: fallbackDemo.identifier,
          token: 'demo_token_authenticated',
          refresh_token: 'demo_refresh_token',
        });
        navigate(routeForRole(fallbackDemo.role));
      } else {
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          'Authentication failed. Please check your credentials.';
        setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter your Email / Phone / Username / Worker ID and password.');
      return;
    }
    await performLogin(identifier.trim(), password, selectedRole.id, {
      role: selectedRole.id,
      identifier: identifier.trim(),
      name: selectedRole.title,
    });
  };

  const handleQuickDemo = async (demo) => {
    const roleObj = ROLES.find((r) => r.id === demo.role) || ROLES[0];
    setSelectedRole(roleObj);
    setMode('login');
    setIdentifier(demo.identifier);
    setPassword(demo.password);
    await performLogin(demo.identifier, demo.password, demo.role, demo);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!fullName.trim() || !regPassword) {
      setErrorMsg('Full Name and Password are required.');
      return;
    }
    if (!regEmail.trim() && !regPhone.trim() && !regUsername.trim()) {
      setErrorMsg('Please provide at least one of Email, Phone Number, or Username / Worker ID.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: regEmail.trim() || undefined,
        phone: regPhone.trim() || undefined,
        username: regUsername.trim() || undefined,
        worker_id: regUsername.trim() || undefined,
        password: regPassword,
        role: selectedRole.id,
        worker_type: selectedRole.id === 'field_worker' ? workerType : undefined,
        district: selectedRole.id === 'field_worker' ? district.trim() : undefined,
        specialization: selectedRole.id === 'doctor' ? specialization.trim() : undefined,
      };
      const data = await registerUser(payload);
      if (data?.pending_approval || data?.user?.status === 'pending' || !data?.token) {
        setPendingNotice({
          name: data?.name || fullName.trim(),
          role: selectedRole.title,
          workerId: data?.worker_id || data?.user_id || regUsername.trim() || regEmail.trim() || regPhone.trim(),
          message:
            data?.message ||
            'Your account has been registered and is awaiting Administrator verification before you can sign in.',
        });
        setMode('login');
        setIdentifier(regEmail.trim() || regPhone.trim() || regUsername.trim() || '');
        setPassword('');
        return;
      }
      const effectiveRole = data?.user?.role || data?.role || selectedRole.id;
      navigate(routeForRole(effectiveRole));
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed. Please check your details.';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handlePatientDemo = () => {
    persistUserSession({
      user_id: 'PAT_KGP_01',
      role: 'patient',
      full_name: 'Ramesh Chandra Sen',
      email: 'patient@demo.in',
      token: 'demo_token_patient',
      refresh_token: 'demo_refresh_token',
    });
    navigate('/patient-portal');
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#0B132B] p-4 sm:p-6 font-sans">
      <div className="w-full max-w-4xl relative z-10">
        {/* Institutional Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-900/30 border border-blue-700/40 text-blue-300 text-xs font-semibold tracking-wider uppercase mb-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            National Health Authority · ABDM & DPDP Act 2023 Compliant
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            DiabetesCare AI — Unified Clinical & Field Portal
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl mx-auto">
            Single workstation for Doctors, ASHA / ICDS / CHO Field Collectors, QA Moderators, and Hospital Administrators
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#111C38] border border-[#23355E] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Backend Connection Banner */}
          <div className="rounded-xl bg-[#0B132B] border border-[#23355E] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    !backendStatus.checked
                      ? 'bg-slate-400 animate-pulse'
                      : backendStatus.connected
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                />
                {backendStatus.connected ? (
                  <span className="text-emerald-300 font-semibold">
                    FastAPI Backend Connected ({backendStatus.url || 'Same Origin'})
                  </span>
                ) : (
                  <span className="text-amber-300 font-semibold">
                    Static Cloud Mode (Browser Storage active — works without 405!) · Connect FastAPI (:8000) for multi-device sync
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowServerConfig((v) => !v)}
                className="px-2.5 py-1 rounded bg-[#162347] hover:bg-[#1E2F5E] border border-[#2A3F75] text-blue-300 text-[11px] font-bold"
              >
                {showServerConfig ? 'Hide Server Config' : 'Configure Backend URL'}
              </button>
            </div>

            {showServerConfig && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1D2B52]">
                <input
                  type="text"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  placeholder="http://localhost:8000 or https://your-api.onrender.com"
                  className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-[#111C38] border border-[#253966] text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleSaveServerUrl(serverInput)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  Connect & Test
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveServerUrl('')}
                  className="px-3 py-1.5 rounded-lg bg-[#162347] hover:bg-[#1E2F5E] text-slate-300 text-xs font-semibold border border-[#253966]"
                >
                  Reset / Auto
                </button>
              </div>
            )}
          </div>

          {/* Sign In / Register Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[#1E2E54] pb-4">
            <div className="inline-flex rounded-xl bg-[#0B132B] p-1 border border-[#23355E]">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(''); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  mode === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMsg(''); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  mode === 'register' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register New Account
              </button>
            </div>

            <button
              type="button"
              onClick={handlePatientDemo}
              className="px-3 py-1.5 rounded-lg bg-[#0E1736] hover:bg-[#1A284D] border border-[#253966] text-sky-300 text-[11px] font-semibold transition-colors"
            >
              👤 Patient Portal Demo →
            </button>
          </div>

          {/* 4 Role Cards */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              1. Select Your Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {ROLES.map((role) => {
                const isSelected = selectedRole.id === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className={`text-left p-3.5 rounded-xl transition-all border flex flex-col justify-between ${
                      isSelected
                        ? `bg-[#1A2C56] ${role.border} shadow-md ring-1 ring-blue-500/40`
                        : 'bg-[#142142] border-[#22335A] hover:bg-[#1A2C56]/70'
                    }`}
                  >
                    <div>
                      <span className="text-xl mb-1.5 block">{role.icon}</span>
                      <h3 className="text-xs font-bold text-white">{role.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{role.subtitle}</p>
                    </div>
                    <span className="inline-block mt-2.5 px-2 py-0.5 rounded text-[9px] font-semibold bg-[#23355E] text-slate-200 w-fit">
                      {role.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {pendingNotice && (
            <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/60 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  ⏳ Registration Submitted — Pending Admin Verification
                </p>
                <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 text-[10px] font-mono">
                  ID: {pendingNotice.workerId}
                </span>
              </div>
              <p className="text-xs text-amber-100 leading-relaxed">
                <strong>{pendingNotice.name}</strong> ({pendingNotice.role}) — {pendingNotice.message}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleQuickDemo(QUICK_DEMOS[5])}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold"
                >
                  Sign In as Admin to Verify Now →
                </button>
                <button
                  type="button"
                  onClick={() => setPendingNotice(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#162347] hover:bg-[#1E2F5E] text-slate-200 text-[11px] font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs font-semibold">
              ⚠ {errorMsg}
            </div>
          )}

          {mode === 'login' ? (
            <div className="space-y-5">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Email, Phone, Username, or Worker ID
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. doctor@demo.in, 9831000002, ASHA_WB_0042"
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
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 shadow"
                >
                  {loading ? 'Authenticating…' : `Sign In as ${selectedRole.title}`}
                </button>
              </form>

              {/* 1-Click Quick Login Buttons */}
              <div className="pt-4 border-t border-[#1C2C52]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  1-Click Quick Demo Login (All 4 Roles & Field Subtypes)
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_DEMOS.map((demo) => (
                    <button
                      key={demo.identifier}
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickDemo(demo)}
                      className="px-3 py-1.5 rounded-lg bg-[#0C152E] hover:bg-[#192952] border border-[#253966] text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {demo.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Anirban Sen / Manasi Roy"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Username / Worker ID
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. ASHA_WB_0105 or dr_anirban"
                    className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@hospital.in"
                    className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98310 XXXXX"
                    className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>

                {selectedRole.id === 'field_worker' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Field Worker Type *
                      </label>
                      <select
                        value={workerType}
                        onChange={(e) => setWorkerType(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                      >
                        <option value="ASHA">ASHA (Accredited Social Health Activist)</option>
                        <option value="ICDS">ICDS (Anganwadi / Child Development)</option>
                        <option value="CHO">CHO (Community Health Officer)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        District / Block
                      </label>
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="e.g. Paschim Medinipur"
                        className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                      />
                    </div>
                  </>
                )}

                {selectedRole.id === 'doctor' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Clinical Specialization
                    </label>
                    <input
                      type="text"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Diabetology & Podiatric Wound Care"
                      className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Create Password *
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#0C152E] border border-[#253966] text-white rounded-lg placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors text-xs uppercase tracking-wider disabled:opacity-50 shadow"
              >
                {loading ? 'Creating Account…' : `Register & Enter ${selectedRole.title} Portal`}
              </button>
            </form>
          )}
        </div>

        <div className="mt-5 text-center text-slate-500 text-[11px] space-y-0.5">
          <p>Indian Institute of Technology Kharagpur · Center for Healthcare Informatics</p>
          <p>Midnapore Medical College & Hospital · DPDP Act 2023 Statutory Standard</p>
        </div>
      </div>
    </div>
  );
}
