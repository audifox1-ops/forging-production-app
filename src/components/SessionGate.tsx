import React from 'react';
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import { isDemoMode, supabase } from '../lib/supabase';

type SessionGateProps = {
  children: React.ReactNode;
};

function GateShell({ loading }: { loading?: boolean }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm">
        <div className="flex items-center gap-3 text-gray-900">
          {loading ? (
            <Loader2 size={22} className="animate-spin text-blue-600" />
          ) : (
            <ShieldAlert size={22} className="text-amber-600" />
          )}
          <div className="text-base font-semibold">
            {loading ? '세션을 확인하는 중입니다.' : '로그인이 필요합니다.'}
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {loading
            ? 'Forging Insight와 같은 Supabase 세션을 확인하고 있습니다.'
            : '로그인이 필요합니다. 메인 시스템(Forging Insight)에서 로그인한 뒤 다시 열어주세요'}
        </p>
        {!loading && (
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
          >
            메인으로 이동
            <ArrowRight size={16} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function SessionGate({ children }: SessionGateProps) {
  const [status, setStatus] = React.useState<'checking' | 'ready' | 'blocked'>(
    isDemoMode || !supabase ? 'ready' : 'checking'
  );

  React.useEffect(() => {
    const client = supabase;

    if (isDemoMode || !client) {
      setStatus('ready');
      return undefined;
    }

    let active = true;

    const syncSession = async () => {
      const { data, error } = await client.auth.getSession();
      if (!active) return;

      if (error) {
        setStatus('blocked');
        return;
      }

      setStatus(data.session ? 'ready' : 'blocked');
    };

    void syncSession();

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setStatus(session ? 'ready' : 'blocked');
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (status === 'ready') {
    return <>{children}</>;
  }

  if (status === 'checking') {
    return <GateShell loading />;
  }

  return <GateShell />;
}
