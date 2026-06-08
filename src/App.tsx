import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import UserInputPage from './pages/UserInputPage';
import AdminReportPage from './pages/AdminReportPage';
import PrintReportPage from './pages/PrintReportPage';
import ReportHistoryPage from './pages/ReportHistoryPage';
import UserManagementPage from './pages/UserManagementPage';
import TargetManagementPage from './pages/TargetManagementPage';
import Layout from './components/Layout';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/reports" element={<ReportHistoryPage />} />

          <Route path="/reports/:reportDate" element={<AdminReportPage />} />

          <Route path="/reports/:reportDate/input" element={<UserInputPage />} />

          <Route path="/reports/:reportDate/preview" element={<AdminReportPage />} />

          <Route path="/admin/users" element={<UserManagementPage />} />

          <Route path="/admin/targets" element={<TargetManagementPage />} />

          <Route path="/admin/history" element={<ReportHistoryPage />} />
        </Route>

        <Route path="/reports/:reportDate/print" element={<PrintReportPage />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
