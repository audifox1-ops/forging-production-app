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

    // 주기 동기화는 전 테이블을 통째로 다시 받는다(persistence.ts fetchAll).
    // 30초 주기로 돌리면 하루 1GB가 넘는 전송량이 나와 Supabase 무료 한도(월 5GB)를
    // 며칠 만에 소진한다 - 실제로 2026-08-31 egress 초과로 로그인이 차단됐다.
    // ① 숨은 탭에서는 아예 쏘지 않고 ② 주기를 10분으로 늘린다.
    // 무료 요금제(월 5GB)를 유지하기로 해 여러 대가 동시에 띄워도 한도에 들도록 잡은 값이다.
    // 탭으로 돌아오는 순간은 아래 focus 리스너가 즉시 동기화하므로 체감 지연은 없다.
    const SYNC_INTERVAL_MS = 10 * 60 * 1000;

    const syncFromServer = () => {
      if (document.hidden) return;
      const store = useReportStore.getState();
      if (store.storageMode === 'supabase') {
        void store.hydrateStorage();
      }
    };
    const intervalId = window.setInterval(syncFromServer, SYNC_INTERVAL_MS);
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
