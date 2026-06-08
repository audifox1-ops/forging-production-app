import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Target,
  History,
  ChevronRight,
  Factory,
  Menu,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { useReportStore } from '../store/reportStore';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const { users, currentUserId, setCurrentUserId } = useReportStore();
  const currentUser = users.find(user => user.id === currentUserId) ?? users[0];
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isAdmin || Boolean(currentUser?.can_write);
  const canEdit = isAdmin || Boolean(currentUser?.can_edit);
  const canDelete = isAdmin || Boolean(currentUser?.can_delete);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
    { to: '/reports', icon: FileText, label: '보고서' },
    { to: '/admin/users', icon: Users, label: '담당자 관리' },
    { to: '/admin/targets', icon: Target, label: '목표값 관리' },
    { to: '/admin/history', icon: History, label: '보고 이력' },
  ];

  return (
    <div className="flex h-screen bg-slate-100">
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-blue-900 text-white flex flex-col transition-all duration-300`}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-blue-800">
          <div className="w-8 h-8 bg-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
            <Factory size={18} />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold leading-tight">단조 생산</div>
              <div className="text-xs text-blue-300">보고 시스템</div>
            </div>
          )}
        </div>

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
              <div className="text-xs text-blue-300 truncate">
                {isAdmin ? '관리자 전체 권한' : canWrite || canEdit ? '권한 부여됨' : '읽기 전용'}
              </div>
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
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span>단조 생산 보고 시스템</span>
            <ChevronRight size={14} />
            <span className="text-gray-800 font-medium">
              {format(new Date(), 'yyyy년 MM월 dd일')}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
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
                {isAdmin ? '관리자' : '사용자'}
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

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
