import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';

// Admin Pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminCadets from './pages/admin/Cadets';
import AdminActivities from './pages/admin/Activities';
import AdminApprovals from './pages/admin/Approvals';
import AdminProfile from './pages/admin/Profile';

// Cadet Pages
import CadetLayout from './layouts/CadetLayout';
import CadetDashboard from './pages/cadet/Dashboard';
import CadetProfile from './pages/cadet/Profile';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="cadets" element={<AdminCadets />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="activities" element={<AdminActivities />} />
              <Route path="approvals" element={<AdminApprovals />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>

          {/* Cadet Routes */}
          <Route element={<ProtectedRoute allowedRoles={['cadet']} />}>
            <Route path="/cadet" element={<CadetLayout />}>
              <Route path="dashboard" element={<CadetDashboard />} />
              <Route path="profile" element={<CadetProfile />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
