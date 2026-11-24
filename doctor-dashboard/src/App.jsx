import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { fetchCurrentUser, getStoredUser, getToken } from './services/api';
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
import MobileAppSimulator from './pages/MobileAppSimulator';

import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminSubmissionsPage from './pages/AdminSubmissionsPage';
import AdminPaymentsPage from './pages/AdminPaymentsPage';
import ModeratorDashboard from './pages/ModeratorDashboard';
import FieldCollectorPortal from './pages/FieldCollectorPortal';
import DoctorSubmitPortal from './pages/DoctorSubmitPortal';

function ProtectedRoute({ children }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RoleHome() {
  const role = (getStoredUser()?.role || localStorage.getItem('user_role') || 'doctor').toLowerCase();
  if (role === 'admin' || role === 'hospital_admin') return <Navigate to="/admin-overview" replace />;
  if (role === 'moderator') return <Navigate to="/moderator" replace />;
  if (role === 'field_worker') return <Navigate to="/field-collector" replace />;
  if (role === 'patient') return <Navigate to="/patient-portal" replace />;
  return <DoctorDashboard />;
}

function AppShell() {
  const [doctor, setDoctor] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      return;
    }
    const stored = getStoredUser();
    const role = (stored?.role || localStorage.getItem('user_role') || 'doctor').toLowerCase();

    fetchCurrentUser()
      .then((u) => {
        if (u) setDoctor(u);
      })
      .catch(() => {
        if (role === 'doctor') {
          return fetchDoctorMe()
            .then((d) => {
              if (d) setDoctor(d);
            })
            .catch(() => {});
        }
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
        <Route path="/" element={<RoleHome />} />

        {/* Admin Routes */}
        <Route path="/admin-overview" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
        <Route path="/admin/payments" element={<AdminPaymentsPage />} />

        {/* Moderator Route */}
        <Route path="/moderator" element={<ModeratorDashboard />} />

        {/* Field Collector (ASHA / ICDS / CHO) Route */}
        <Route path="/field-collector" element={<FieldCollectorPortal />} />

        {/* Doctor Workflow Routes */}
        <Route path="/doctor/collect" element={<DoctorSubmitPortal key="collect" defaultTab="collect" />} />
        <Route path="/doctor/validate-queue" element={<DoctorSubmitPortal key="validate" defaultTab="validate" />} />

        {/* Existing Clinical & Portal Routes */}
        <Route path="/patient-portal" element={<PatientPortal />} />
        <Route path="/mobile-simulator" element={<MobileAppSimulator />} />
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
