'use client';

// ============================================================================
// 전역 에러 경계 — Next.js App Router 런타임 에러 캐치
// 모든 페이지의 unexpected error 가 여기 표시됨 (서버 컴포넌트 + 클라이언트 컴포넌트)
// ============================================================================

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[OMWIS error boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#171b26] border border-red-500/30 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">잠시 후 다시 시도해주세요</h1>
        <p className="text-sm text-gray-400 mb-1">
          예기치 못한 오류가 발생했습니다.
        </p>
        <p className="text-xs text-gray-500 mb-6">
          문제가 계속되면 (주)홍지 관리자에게 알려주세요.
          {error.digest && (
            <span className="block mt-1 font-mono">에러 ID: {error.digest}</span>
          )}
        </p>

        {process.env.NODE_ENV !== 'production' && error.message && (
          <details className="mb-6 text-left text-[11px] text-gray-500 bg-[#0f1117] rounded p-3">
            <summary className="cursor-pointer text-gray-400">개발 정보</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">{error.message}</pre>
          </details>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-lg bg-[#1a3d6b] hover:bg-[#235490] text-white text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
          <Link
            href="/login"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-lg border border-[#2a2f3e] text-gray-300 hover:bg-white/[0.04] text-sm font-semibold"
          >
            <Home className="w-4 h-4" />
            로그인 페이지
          </Link>
        </div>
      </div>
    </div>
  );
}
