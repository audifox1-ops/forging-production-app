import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Factory, Eye, EyeOff, AlertCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: '관리자', email: 'admin@forging.com', password: 'admin1234', role: 'admin' },
  { label: 'P15 주간 (김과장)', email: 'kim@forging.com', password: 'user1234', role: 'user' },
  { label: 'P5 주간 (박차장)', email: 'park@forging.com', password: 'user1234', role: 'user' },
  { label: 'R/M 주간 (이대리)', email: 'lee@forging.com', password: 'user1234', role: 'user' },
  { label: '야간반장', email: 'night@forging.com', password: 'user1234', role: 'user' },
];

export default function LoginPage() {
  const { login, isLoading, currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [emailOrEmpNo, setEmailOrEmpNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (currentUser) {
      navigate(currentUser.role === 'user' ? '/reports' : '/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailOrEmpNo.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    const ok = await login(emailOrEmpNo.trim(), password.trim());
    if (!ok) {
      setError('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  const fillAccount = (email: string, pw: string) => {
    setEmailOrEmpNo(email);
    setPassword(pw);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <Factory size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">단조 생산 보고</h1>
          <p className="text-blue-200 mt-2 text-sm">일일 생산목표 대비 실적 관리 시스템</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-blue-800 px-6 py-4">
            <h2 className="text-white font-semibold text-lg">로그인</h2>
            <p className="text-blue-200 text-xs mt-0.5">이메일 또는 사번으로 로그인하세요</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">이메일 / 사번</label>
                <input
                  type="text"
                  value={emailOrEmpNo}
                  onChange={e => setEmailOrEmpNo(e.target.value)}
                  placeholder="이메일 또는 사번을 입력하세요"
                  className="form-input"
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="form-label">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="form-input pr-10"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 active:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            {/* 데모 계정 */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3 text-center">
                🔑 데모 계정으로 빠르게 체험하기
              </p>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillAccount(acc.email, acc.password)}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-gray-200 rounded-lg text-sm transition-colors"
                  >
                    <span className="font-medium text-gray-700">{acc.label}</span>
                    <span className="text-xs text-gray-400">{acc.email}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                관리자 비밀번호: admin1234 / 담당자: user1234
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
