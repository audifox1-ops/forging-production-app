import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Target,
  Table2,
  History,
  ChevronRight,
  Home,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { useReportStore } from '../store/reportStore';
import { useToast } from './Toast';

const APP_NAME = 'TAEWOONG Dispatch';
const APP_TAGLINE = 'Production Control';
const APP_LOGO_SRC = '/taewoong-dispatch-logo.svg';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const { showToast } = useToast();
  const {
    users,
    currentUserId,
    setCurrentUserId,
    storageMode,
    isHydrating,
    syncError,
    lastSyncedAt,
    hydrateStorage,
  } = useReportStore();
  const currentUser = users.find(user => user.id === currentUserId) ?? users[0];
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isAdmin || Boolean(currentUser?.can_write);
  const canEdit = isAdmin || Boolean(currentUser?.can_edit);
  const canDelete = isAdmin || Boolean(currentUser?.can_delete);
  const roleLabel = isAdmin ? '관리자' : currentUser?.role === 'manager' ? '총괄' : '사용자';
  const permissionLabel = isAdmin
    ? '관리자 전체 권한'
    : currentUser?.role === 'manager'
      ? '총괄 권한'
      : canWrite || canEdit
        ? '입력 및 편집 가능'
        : '읽기 전용';

  React.useEffect(() => {
    if (syncError) {
      showToast(syncError, 'error', 5000);
    }
  }, [syncError, showToast]);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
    { to: '/reports', icon: FileText, label: '보고서' },
    { to: '/template-workbook', icon: Table2, label: '생산량 집계' },
    { to: '/admin/users', icon: Users, label: '담당자 관리' },
    { to: '/admin/targets', icon: Target, label: '목표값 관리' },
    { to: '/admin/history', icon: History, label: '보고 이력' },
  ];

  const storageTitle =
    syncError ||
    (storageMode === 'supabase'
      ? lastSyncedAt
        ? `마지막 서버 동기화 ${format(new Date(lastSyncedAt), 'HH:mm')}`
        : 'Supabase 서버와 연결되어 부서원과 공유됩니다'
      : '이 브라우저에만 저장되어 다른 자리와 공유되지 않습니다');

  const storageLabel = isHydrating
    ? '동기화 중'
    : syncError
      ? '공유 저장소 오류'
      : storageMode === 'supabase'
        ? '서버 공유 모드'
        : '로컬 전용';

  return (
    <div className="flex h-screen bg-slate-100">
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-blue-900 text-white flex flex-col transition-all duration-300`}
      >
        <NavLink
          to="/dashboard"
          className="flex items-center gap-3 px-4 py-5 border-b border-blue-800 hover:bg-blue-800/70 transition-colors"
          title="대시보드로 이동"
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
            <img src={APP_LOGO_SRC} alt={APP_NAME} className="w-full h-full object-cover" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold leading-tight">{APP_NAME}</div>
              <div className="text-xs text-blue-300">{APP_TAGLINE}</div>
            </div>
          )}
        </NavLink>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`
              }
            >
              <item.icon size={18} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-blue-800 p-3">
          {sidebarOpen ? (
            <div className="overflow-hidden">
              <div className="text-sm font-medium truncate">{currentUser?.name || '계정 선택'}</div>
              <div className="text-xs text-blue-300 truncate">{permissionLabel}</div>
            </div>
          ) : (
            <div className="w-full flex justify-center text-blue-300" title={currentUser?.name || '계정 선택'}>
              <Users size={16} />
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 no-print">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={sidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <NavLink
            to="/dashboard"
            className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            title="대시보드로 이동"
          >
            <Home size={18} />
          </NavLink>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
            <NavLink to="/dashboard" className="hover:text-blue-700 transition-colors truncate">
              {APP_NAME}
            </NavLink>
            <ChevronRight size={14} />
            <span className="text-gray-800 font-medium">
              {format(new Date(), 'yyyy년 MM월 dd일')}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                syncError
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : storageMode === 'supabase'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title={storageTitle}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isHydrating
                    ? 'bg-amber-500'
                    : syncError
                      ? 'bg-red-500'
                      : storageMode === 'supabase'
                        ? 'bg-green-500'
                        : 'bg-slate-400'
                }`}
              />
              {storageLabel}
            </div>
            {syncError && (
              <button
                onClick={() => void hydrateStorage()}
                disabled={isHydrating}
                className="hidden lg:flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                title="동기화 다시 시도"
              >
                <RefreshCw size={12} className={isHydrating ? 'animate-spin' : ''} />
                다시 시도
              </button>
            )}
            <select
              value={currentUserId}
              onChange={event => setCurrentUserId(event.target.value)}
              className="form-select w-auto py-1.5 text-sm"
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <div className="hidden md:flex items-center gap-1.5 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {roleLabel}
              </span>
              {canWrite && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">쓰기</span>}
              {canEdit && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">편집</span>}
              {canDelete && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">삭제</span>}
              {!isAdmin && !canWrite && !canEdit && !canDelete && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">읽기 전용</span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 main-content">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav md:hidden">
        {navItems.slice(0, 4).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
