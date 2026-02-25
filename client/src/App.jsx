import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import ReloadPrompt from './components/ReloadPrompt';
import KeepAlive from './components/KeepAlive';
import { Toaster } from 'react-hot-toast';
import SafeAreaManager, { SafeAreaProvider } from './components/SafeAreaManager';

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
const AdminAchievements = lazy(() => import('./pages/admin/Achievements'));
const AdminDataAnalysis = lazy(() => import('./pages/admin/DataAnalysis'));
const AdminPerformanceMonitor = lazy(() => import('./pages/admin/PerformanceMonitor'));
const AdminProfile = lazy(() => import('./pages/admin/Profile'));
const AdminStaff = lazy(() => import('./pages/admin/TrainingStaffManagement'));
const AdminStaffScanner = lazy(() => import('./pages/admin/StaffAttendanceScanner'));
const AdminStaffAnalytics = lazy(() => import('./pages/admin/StaffAnalytics'));
const AdminAbsenceAnalytics = lazy(() => import('./pages/admin/AbsenceAnalytics'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const BroadcastMessages = lazy(() => import('./pages/BroadcastMessages'));
const Admin3DStudio = lazy(() => import('./pages/admin/ThreeDStudio'));

// Cadet Pages
const CadetLayout = lazy(() => import('./layouts/CadetLayout'));
const CadetHome = lazy(() => import('./pages/cadet/Home'));
const CadetDashboard = lazy(() => import('./pages/cadet/Dashboard'));
const CadetNotifications = lazy(() => import('./pages/cadet/NotificationHistory'));
const CadetProfile = lazy(() => import('./pages/cadet/Profile'));
const CadetAbout = lazy(() => import('./pages/cadet/About'));
const CadetAchievements = lazy(() => import('./pages/cadet/Achievements'));
const AskAdmin = lazy(() => import('./pages/AskAdmin'));

// Staff Pages
const StaffLayout = lazy(() => import('./layouts/StaffLayout'));
const StaffHome = lazy(() => import('./pages/staff/Home'));
const StaffDashboard = lazy(() => import('./pages/staff/Dashboard'));
const StaffAchievements = lazy(() => import('./pages/staff/Achievements'));
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
      <SafeAreaProvider>
        <Router>
          <AuthProvider>
            <SettingsProvider>
              <Toaster position="top-center" />
              <ReloadPrompt />
              <KeepAlive />
              <SafeAreaManager className="min-h-screen">
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
                <Route path="absence-analytics" element={<AdminAbsenceAnalytics />} />
                <Route path="activities" element={<AdminActivities />} />
                <Route path="achievements" element={<AdminAchievements />} />
                <Route path="data-analysis" element={<AdminDataAnalysis />} />
                <Route path="performance" element={<AdminPerformanceMonitor />} />
                <Route path="3d" element={<Admin3DStudio />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="broadcasts" element={<BroadcastMessages />} />
                <Route path="settings" element={<Settings role="admin" />} />
                <Route index element={<Navigate to="cadets" replace />} />
              </Route>
            </Route>

            {/* Cadet Routes */}
            <Route element={<ProtectedRoute allowedRoles={['cadet']} />}>
              <Route path="/cadet" element={<CadetLayout />}>
                <Route path="home" element={<CadetHome />} />
                <Route path="dashboard" element={<CadetDashboard />} />
                <Route path="notifications" element={<CadetNotifications />} />
                <Route path="profile" element={<CadetProfile />} />
                <Route path="achievements" element={<CadetAchievements />} />
                <Route path="broadcasts" element={<BroadcastMessages />} />
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
                <Route path="achievements" element={<StaffAchievements />} />
                <Route path="profile" element={<StaffProfile />} />
                <Route path="profile-completion" element={<StaffOnboarding />} />
                <Route path="communication" element={<StaffCommunication />} />
                <Route path="broadcasts" element={<BroadcastMessages />} />
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
              </SafeAreaManager>
            </SettingsProvider>
          </AuthProvider>
        </Router>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;
