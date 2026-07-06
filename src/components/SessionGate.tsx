// SessionGate — 통합 인증 게이트.
// 배경: Supabase 프로젝트를 Forging Insight와 통합하면서 모든 테이블이
//   authenticated 전용 RLS로 보호된다. 같은 도메인 + 같은 프로젝트이므로
//   메인 시스템(Forging Insight)에서 로그인하면 세션이 자동 공유된다.
// 동작: 세션 확인 중 → 로딩 / 세션 없음 → 메인으로 안내 / 세션 있음 → 앱 렌더.
//   Supabase 미설정(데모 모드)이면 기존 동작 그대로 통과시킨다.

import React from 'react';
import supabase, { isDemoMode } from '../lib/supabase';

export function SessionGate({ children }: { children: React.ReactNode }) {
  // checking: 최초 세션 확인 중, authed: 로그인 세션 존재 여부
  const [checking, setChecking] = React.useState(!isDemoMode);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    if (isDemoMode || !supabase) return;
    let mounted = true;

    // 최초 1회 세션 확인 (메인 시스템에서 로그인했다면 여기서 바로 통과)
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(Boolean(data.session));
      setChecking(false);
    });

    // 로그인/로그아웃/토큰 갱신을 구독해 상태 반영
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAuthed(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (isDemoMode) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <p className="text-sm text-gray-500">로그인 상태 확인 중...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 px-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-xl shadow-sm p-7 text-center">
          <h1 className="text-lg font-semibold text-slate-800 mb-2">로그인이 필요합니다</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">
            생산일보는 부서 통합 시스템(Forging Insight)과 계정을 함께 사용합니다.
            메인 시스템에서 로그인한 뒤 다시 열어주세요.
          </p>
          {/* 별도 앱이므로 react-router Link가 아닌 일반 링크로 전체 이동 */}
          <a
            href="/"
            className="inline-block w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5"
          >
            메인 시스템으로 이동
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default SessionGate;
