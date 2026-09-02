import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { getToken } from './services/api';
import { fetchDoctorMe } from './services/doctorService';

import DoctorDashboard from './pages/DoctorDashboard';
import DoctorLogin from './pages/DoctorLogin';
import PatientWoundDetail from './pages/PatientWoundDetail';
import PrescriptionWriter from './pages/PrescriptionWriter';
import TeleconsultScheduler from './pages/TeleconsultScheduler';
import DepartmentDashboard from './pages/DepartmentDashboard';
import AlertManagement from './pages/AlertManagement';
import AnalyticsPage from './pages/AnalyticsPage';
import AshaWorkersPage from './pages/AshaWorkersPage';
import DpdpCompliancePage from './pages/DpdpCompliancePage';
import SettingsPage from './pages/SettingsPage';
import PatientPortal from './pages/PatientPortal';
import AdminDashboard from './pages/AdminDashboard';

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
      .then((d) => {
        setDoctor(d || { name: 'Dr. Clinical Specialist', role: 'doctor', specialisation: 'Diabetology & Vascular Wound Care' });
      })
      .catch(() => {
        setDoctor({ name: 'Dr. Clinical Specialist', role: 'doctor', specialisation: 'Diabetology & Vascular Wound Care' });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex items-center justify-center text-blue-400 font-semibold text-xs">
        Initializing Clinical Workstation…
      </div>
    );
  }

  return (
    <Layout doctor={doctor}>
      <Routes>
        <Route path="/" element={<DoctorDashboard />} />
        <Route path="/admin-overview" element={<AdminDashboard />} />
        <Route path="/patient-portal" element={<PatientPortal />} />
        <Route path="/patients/:patientId" element={<PatientWoundDetail />} />
        <Route path="/alerts/:alertId" element={<AlertManagement />} />
        <Route path="/teleconsults" element={<TeleconsultScheduler />} />
        <Route path="/prescriptions/:patientId" element={<PrescriptionWriter />} />
        <Route path="/department" element={<DepartmentDashboard />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/asha" element={<AshaWorkersPage />} />
        <Route path="/dpdp" element={<DpdpCompliancePage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
