// SessionGate — 조회는 누구나, 수정은 로그인(관리자)만.
// 운영 방침: 부서원은 로그인 없이 일보를 조회한다.
//   DB(RLS)가 익명에게 SELECT만 허용하므로, 비로그인 상태의 수정 시도는
//   저장 단계에서 거부된다. 이 컴포넌트는 차단 대신 상단에 얇은 배너로
//   현재 모드(조회 전용/관리자)를 알려 혼란을 줄인다.
// 관리자 로그인: 같은 도메인의 메인 시스템(Forging Insight)에서 로그인하면
//   세션이 자동 공유되어 배너가 관리자 모드로 바뀐다.

import React from 'react';
import supabase, { isDemoMode } from '../lib/supabase';

export function SessionGate({ children }: { children: React.ReactNode }) {
  // authed: 로그인 세션 존재 여부 (null = 확인 중)
  const [authed, setAuthed] = React.useState<boolean | null>(isDemoMode ? true : null);
  // dismissed: 조회 모드 배너를 사용자가 닫았는지 (세션 동안만 기억)
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (isDemoMode || !supabase) return;
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAuthed(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 조회 전용 배너: 비로그인 확정 상태에서만, 닫기 전까지 표시
  const showViewerBanner = !isDemoMode && authed === false && !dismissed;

  return (
    <>
      {showViewerBanner && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 flex items-center justify-between gap-3">
          <span>
            조회 전용 모드입니다 — 열람은 자유롭게, 입력·수정은 관리자 로그인 후 가능합니다.
          </span>
          <span className="flex items-center gap-3 shrink-0">
            <a href="/" className="underline font-medium hover:text-amber-900">
              관리자 로그인
            </a>
            <button
              type="button"
              aria-label="안내 닫기"
              className="font-bold px-1 hover:text-amber-900"
              onClick={() => setDismissed(true)}
            >
              ×
            </button>
          </span>
        </div>
      )}
      {children}
    </>
  );
}

export default SessionGate;
