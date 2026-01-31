import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { lazyRetry } from './utils/lazyRetry';

// Lazy Load Pages
const Login = lazyRetry(() => import('./pages/Login'));
const Home = lazyRetry(() => import('./pages/Home'));

// Admin Pages
const AdminLayout = lazyRetry(() => import('./layouts/AdminLayout'));
const AdminDashboard = lazyRetry(() => import('./pages/admin/Dashboard'));
const AdminCadets = lazyRetry(() => import('./pages/admin/Cadets'));
const AdminGrading = lazyRetry(() => import('./pages/admin/Grading'));
const AdminAttendance = lazyRetry(() => import('./pages/admin/Attendance'));
const AdminActivities = lazyRetry(() => import('./pages/admin/Activities'));
const AdminProfile = lazyRetry(() => import('./pages/admin/Profile'));
const AdminStaff = lazyRetry(() => import('./pages/admin/TrainingStaffManagement'));

// Cadet Pages
const CadetLayout = lazyRetry(() => import('./layouts/CadetLayout'));
const CadetHome = lazyRetry(() => import('./pages/cadet/Home'));
const CadetDashboard = lazyRetry(() => import('./pages/cadet/Dashboard'));
const CadetProfile = lazyRetry(() => import('./pages/cadet/Profile'));
const CadetAbout = lazyRetry(() => import('./pages/cadet/About'));
const CadetOnboarding = lazyRetry(() => import('./pages/cadet/Onboarding'));

// Staff Pages
const StaffLayout = lazyRetry(() => import('./layouts/StaffLayout'));
const StaffHome = lazyRetry(() => import('./pages/staff/Home'));
const StaffDashboard = lazyRetry(() => import('./pages/staff/Dashboard'));
const StaffProfile = lazyRetry(() => import('./pages/staff/Profile'));
const StaffOnboarding = lazyRetry(() => import('./pages/staff/Onboarding'));

// Loading Fallback
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  console.log("App Version: 2.3.19 (Lazy Load Retry Fix)");

  // Clear the retry flag on successful app load
  useEffect(() => {
    window.sessionStorage.removeItem('retry-lazy-refreshed');
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Home />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="cadets" element={<AdminCadets />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="grading" element={<AdminGrading />} />
                <Route path="attendance" element={<AdminAttendance />} />
                <Route path="activities" element={<AdminActivities />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Route>
            </Route>

            {/* Cadet Routes */}
            <Route element={<ProtectedRoute allowedRoles={['cadet']} />}>
              <Route path="/cadet" element={<CadetLayout />}>
                <Route path="home" element={<CadetHome />} />
                <Route path="dashboard" element={<CadetDashboard />} />
                <Route path="profile" element={<CadetProfile />} />
                <Route path="about" element={<CadetAbout />} />
                <Route index element={<Navigate to="home" replace />} />
              </Route>
              {/* Onboarding Route - outside Layout to avoid Sidebar */}
              <Route path="/cadet/onboard" element={<CadetOnboarding />} />
            </Route>

            {/* Staff Routes */}
            <Route element={<ProtectedRoute allowedRoles={['training_staff']} />}>
              <Route path="/staff" element={<StaffLayout />}>
                <Route path="home" element={<StaffHome />} />
                <Route path="dashboard" element={<StaffDashboard />} />
                <Route path="profile" element={<StaffProfile />} />
                <Route index element={<Navigate to="home" replace />} />
              </Route>
              {/* Onboarding Route - outside Layout to avoid Sidebar */}
              <Route path="/staff/onboard" element={<StaffOnboarding />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
