import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useReportStore } from './store/reportStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const UserInputPage = React.lazy(() => import('./pages/UserInputPage'));
const AdminReportPage = React.lazy(() => import('./pages/AdminReportPage'));
const PrintReportPage = React.lazy(() => import('./pages/PrintReportPage'));
const ReportHistoryPage = React.lazy(() => import('./pages/ReportHistoryPage'));
const TemplateWorkbookPage = React.lazy(() => import('./pages/TemplateWorkbookPage'));
const UserManagementPage = React.lazy(() => import('./pages/UserManagementPage'));
const TargetManagementPage = React.lazy(() => import('./pages/TargetManagementPage'));
const Layout = React.lazy(() => import('./components/Layout'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">페이지를 불러오는 중...</p>
      </div>
    </div>
  );
}

function App() {
  React.useEffect(() => {
    void useReportStore.getState().hydrateStorage();

    const syncFromServer = () => {
      const store = useReportStore.getState();
      if (store.storageMode === 'supabase') {
        void store.hydrateStorage();
      }
    };
    const intervalId = window.setInterval(syncFromServer, 30000);
    window.addEventListener('focus', syncFromServer);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncFromServer);
    };
  }, []);

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <HashRouter>
      <Suspense fallback={<PageLoader />}>
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

            <Route path="/template-workbook" element={<TemplateWorkbookPage />} />
          </Route>

          <Route path="/reports/:reportDate/print" element={<PrintReportPage />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
