import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorLogin } from '../services/api';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('doctor@demo.in');
  const [password, setPassword] = useState('doctor123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await doctorLogin(email.trim(), password);
      if (data.role !== 'doctor') {
        setError('This account is not authorised for the doctor dashboard.');
        return;
      }
      navigate('/');
    } catch (err) {
      let msg =
        err.response?.data?.error?.message ||
        err.message ||
        'Login failed. Check credentials and API server.';
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        msg =
          'Cannot reach the API on port 8000. Start the backend: cd backend/legacy && source venv/bin/activate && export PORT=8000 DATABASE_URL=sqlite:///instance/healthscreen_dev.db PYTHONPATH=. && python app.py';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F8FC]">
      <div className="w-[480px] bg-white border border-[#D4D9E0] rounded-xl shadow-lg p-10">
        <h1 className="text-2xl font-bold text-[#1A3A5C]">Doctor sign in</h1>
        <p className="mt-2 text-[#5A5A5A] text-sm">
          Web dashboard for wound monitoring review and prescriptions.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#0F0F0F] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2463AE]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#0F0F0F] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-[#D4D9E0] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2463AE]"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-[#7B1818] font-semibold bg-[#FBE8E8] border border-[#C0392B] rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A3A5C] text-white font-bold py-3 rounded-lg hover:bg-[#2463AE] disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-xs text-[#5A5A5A]">
          Demo: doctor@demo.in / doctor123 (requires Flask API on port 8000)
        </p>
      </div>
    </div>
  );
}
