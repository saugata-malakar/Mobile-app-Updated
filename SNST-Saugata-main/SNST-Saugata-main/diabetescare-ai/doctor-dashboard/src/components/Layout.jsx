import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAuth } from '../services/api';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/teleconsults', label: 'Teleconsults' },
  { to: '/department', label: 'Department' },
];

export default function Layout({ doctor, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#1A3A5C] text-white px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-10">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Diabetes Care AI</h1>
            <p className="text-sm text-blue-200">Doctor Dashboard</p>
          </div>
          <nav className="flex gap-2">
            {NAV.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-4 py-2 rounded-md text-sm font-semibold ${
                  location.pathname === item.to
                    ? 'bg-[#2463AE]'
                    : 'hover:bg-white/10'
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <div className="font-semibold">{doctor?.name}</div>
            <div className="text-blue-200">
              {doctor?.specialisation} · {doctor?.hospital_name}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="border border-white/40 px-4 py-2 rounded-md hover:bg-white/10 font-semibold">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 p-8">
        {children}
      </main>
      <footer className="text-center text-xs text-[#5A5A5A] py-3 border-t border-[#D4D9E0]">
        AI-assisted screening only. Not a medical diagnosis. · Desktop clinical workstation
      </footer>
    </div>
  );
}
