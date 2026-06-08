import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UserInputPage from './pages/UserInputPage';
import AdminReportPage from './pages/AdminReportPage';
import PrintReportPage from './pages/PrintReportPage';
import ReportHistoryPage from './pages/ReportHistoryPage';
import UserManagementPage from './pages/UserManagementPage';
import TargetManagementPage from './pages/TargetManagementPage';
import Layout from './components/Layout';

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { currentUser } = useAuthStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function App() {
  const { currentUser } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          } />

          <Route path="/reports" element={
            <RequireAuth>
              <ReportHistoryPage />
            </RequireAuth>
          } />

          <Route path="/reports/:reportDate" element={
            <RequireAuth>
              <AdminReportPage />
            </RequireAuth>
          } />

          <Route path="/reports/:reportDate/input" element={
            <RequireAuth>
              <UserInputPage />
            </RequireAuth>
          } />

          <Route path="/reports/:reportDate/preview" element={
            <RequireAuth>
              <AdminReportPage />
            </RequireAuth>
          } />

          <Route path="/admin/users" element={
            <RequireAuth roles={['admin', 'manager']}>
              <UserManagementPage />
            </RequireAuth>
          } />

          <Route path="/admin/targets" element={
            <RequireAuth roles={['admin', 'manager']}>
              <TargetManagementPage />
            </RequireAuth>
          } />

          <Route path="/admin/history" element={
            <RequireAuth roles={['admin', 'manager']}>
              <ReportHistoryPage />
            </RequireAuth>
          } />
        </Route>

        <Route path="/reports/:reportDate/print" element={
          <RequireAuth>
            <PrintReportPage />
          </RequireAuth>
        } />

        <Route path="/" element={
          currentUser
            ? <Navigate to={currentUser.role === 'user' ? '/reports' : '/dashboard'} replace />
            : <Navigate to="/login" replace />
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
