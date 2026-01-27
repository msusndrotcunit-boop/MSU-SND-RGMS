import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy Load Pages
const Login = lazy(() => import('./pages/Login'));

// Admin Pages
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminCadets = lazy(() => import('./pages/admin/Cadets'));
const AdminGrading = lazy(() => import('./pages/admin/Grading'));
const AdminAttendance = lazy(() => import('./pages/admin/Attendance'));
const AdminActivities = lazy(() => import('./pages/admin/Activities'));
const AdminProfile = lazy(() => import('./pages/admin/Profile'));

// Cadet Pages
const CadetLayout = lazy(() => import('./layouts/CadetLayout'));
const CadetHome = lazy(() => import('./pages/cadet/Home'));
const CadetDashboard = lazy(() => import('./pages/cadet/Dashboard'));
const CadetProfile = lazy(() => import('./pages/cadet/Profile'));
const CadetAbout = lazy(() => import('./pages/cadet/About'));

// Loading Fallback
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  console.log("App Version: 2.3.18 (OneDrive Fix & Activities UI)");
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="cadets" element={<AdminCadets />} />
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
