import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Target,
  History,
  LogOut,
  ChevronRight,
  Factory,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';

export default function Layout() {
  const { currentUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const navItems = [
    ...(isAdmin ? [{ to: '/dashboard', icon: LayoutDashboard, label: '대시보드' }] : []),
    {
      to: currentUser?.role === 'user' ? `/reports/${today}/input` : '/reports',
      icon: FileText,
      label: currentUser?.role === 'user' ? '실적 입력' : '보고서',
    },
    ...(isAdmin ? [
      { to: '/admin/users', icon: Users, label: '담당자 관리' },
      { to: '/admin/targets', icon: Target, label: '목표값 관리' },
      { to: '/admin/history', icon: History, label: '보고 이력' },
    ] : []),
  ];

  return (
    <div className="flex h-screen bg-slate-100">
      {/* 사이드바 */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-blue-900 text-white flex flex-col transition-all duration-300`}
      >
        {/* 로고 영역 */}
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

        {/* 내비게이션 */}
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

        {/* 유저 정보 */}
        <div className="border-t border-blue-800 p-3">
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="overflow-hidden">
                <div className="text-sm font-medium truncate">{currentUser?.name}</div>
                <div className="text-xs text-blue-300 truncate">
                  {currentUser?.role === 'admin' ? '관리자' :
                    currentUser?.role === 'manager' ? '매니저' :
                      currentUser?.role === 'viewer' ? '조회자' : '담당자'}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-800 rounded-lg transition-colors"
                title="로그아웃"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full p-1.5 text-blue-300 hover:text-white hover:bg-blue-800 rounded-lg transition-colors flex justify-center"
              title="로그아웃"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
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
            <span className="text-sm text-gray-600">
              {currentUser?.name}
              <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {currentUser?.role === 'admin' ? '관리자' :
                  currentUser?.role === 'manager' ? '매니저' :
                    currentUser?.role === 'viewer' ? '조회자' : '담당자'}
              </span>
            </span>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
