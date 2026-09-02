import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { getToken } from './services/api';
import { fetchDoctorMe } from './services/doctorService';
import AlertManagement from './pages/AlertManagement';
import DepartmentDashboard from './pages/DepartmentDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorLogin from './pages/DoctorLogin';
import PatientWoundDetail from './pages/PatientWoundDetail';
import PrescriptionWriter from './pages/PrescriptionWriter';
import TeleconsultScheduler from './pages/TeleconsultScheduler';

function ProtectedRoute({ children }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppShell() {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    fetchDoctorMe()
      .then(d => {
        if (d?.role !== 'doctor') {
          throw new Error('Not a doctor');
        }
        setDoctor(d);
      })
      .catch(() => {
        localStorage.clear();
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#5A5A5A]">
        Loading…
      </div>
    );
  }

  if (!doctor) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout doctor={doctor}>
      <Routes>
        <Route path="/" element={<DoctorDashboard />} />
        <Route path="/patients/:patientId" element={<PatientWoundDetail />} />
        <Route path="/alerts/:alertId" element={<AlertManagement />} />
        <Route path="/teleconsults" element={<TeleconsultScheduler />} />
        <Route path="/prescriptions/:patientId" element={<PrescriptionWriter />} />
        <Route path="/department" element={<DepartmentDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<DoctorLogin />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
