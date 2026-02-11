import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ReloadPrompt from './components/ReloadPrompt';
import KeepAlive from './components/KeepAlive';
import { Toaster } from 'react-hot-toast';

// Lazy Load Pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));

// Admin Pages
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminCadets = lazy(() => import('./pages/admin/Cadets'));
const AdminArchivedCadets = lazy(() => import('./pages/admin/ArchivedCadets'));
const AdminGrading = lazy(() => import('./pages/admin/Grading'));
const AdminAttendance = lazy(() => import('./pages/admin/Attendance'));
const AdminActivities = lazy(() => import('./pages/admin/Activities'));
const AdminDataAnalysis = lazy(() => import('./pages/admin/DataAnalysis'));
const AdminProfile = lazy(() => import('./pages/admin/Profile'));
const AdminStaff = lazy(() => import('./pages/admin/TrainingStaffManagement'));
const AdminStaffScanner = lazy(() => import('./pages/admin/StaffAttendanceScanner'));
const AdminStaffAnalytics = lazy(() => import('./pages/admin/StaffAnalytics'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminBroadcast = lazy(() => import('./pages/admin/AdminBroadcast'));

// Cadet Pages
const CadetLayout = lazy(() => import('./layouts/CadetLayout'));
const CadetHome = lazy(() => import('./pages/cadet/Home'));
const CadetDashboard = lazy(() => import('./pages/cadet/Dashboard'));
const CadetProfile = lazy(() => import('./pages/cadet/Profile'));
const CadetAbout = lazy(() => import('./pages/cadet/About'));
const AskAdmin = lazy(() => import('./pages/AskAdmin'));

// Staff Pages
const StaffLayout = lazy(() => import('./layouts/StaffLayout'));
const StaffHome = lazy(() => import('./pages/staff/Home'));
const StaffDashboard = lazy(() => import('./pages/staff/Dashboard'));
const StaffProfile = lazy(() => import('./pages/staff/Profile'));
const StaffOnboarding = lazy(() => import('./pages/staff/Onboarding'));
const StaffCommunication = lazy(() => import('./pages/staff/Communication'));
const StaffMyQRCode = lazy(() => import('./pages/staff/MyQRCode'));

// Loading Fallback
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  console.log(`App Version: ${import.meta.env.PACKAGE_VERSION} (Deploy 2026-02-10 Cache Bust)`);
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <SettingsProvider>
            <Toaster position="top-center" />
            <ReloadPrompt />
            <KeepAlive />
            <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="cadets" element={<AdminCadets />} />
                <Route path="archived-cadets" element={<AdminArchivedCadets />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="grading" element={<AdminGrading />} />
                <Route path="attendance" element={<AdminAttendance />} />
                <Route path="staff-scanner" element={<AdminStaffScanner />} />
                <Route path="staff-analytics" element={<AdminStaffAnalytics />} />
                <Route path="activities" element={<AdminActivities />} />
                <Route path="data-analysis" element={<AdminDataAnalysis />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="broadcast" element={<AdminBroadcast />} />
                <Route path="settings" element={<Settings role="admin" />} />
                <Route index element={<Navigate to="cadets" replace />} />
              </Route>
            </Route>

            {/* Cadet Routes */}
            <Route element={<ProtectedRoute allowedRoles={['cadet']} />}>
              <Route path="/cadet" element={<CadetLayout />}>
                <Route path="home" element={<CadetHome />} />
                <Route path="dashboard" element={<CadetDashboard />} />
                <Route path="profile" element={<CadetProfile />} />
                <Route path="about" element={<CadetAbout />} />
                <Route path="ask-admin" element={<AskAdmin />} />
                <Route path="settings" element={<Settings role="cadet" />} />
                <Route index element={<Navigate to="home" replace />} />
              </Route>
            </Route>

            {/* Staff Routes */}
            <Route element={<ProtectedRoute allowedRoles={['training_staff']} />}>
              <Route path="/staff" element={<StaffLayout />}>
                <Route path="home" element={<StaffHome />} />
                <Route path="dashboard" element={<StaffDashboard />} />
                <Route path="unit-dashboard" element={<AdminDashboard />} />
                <Route path="data-analysis" element={<AdminDataAnalysis />} />
                <Route path="activities" element={<AdminActivities />} />
                <Route path="profile" element={<StaffProfile />} />
                <Route path="profile-completion" element={<StaffOnboarding />} />
                <Route path="communication" element={<StaffCommunication />} />
                <Route path="my-qr" element={<StaffMyQRCode />} />
                <Route path="ask-admin" element={<AskAdmin />} />
                <Route path="settings" element={<Settings role="staff" />} />
                <Route index element={<Navigate to="home" replace />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
            </Suspense>
          </SettingsProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
