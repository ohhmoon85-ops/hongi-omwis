'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// 지정 간격마다 서버 컴포넌트 재실행 트리거 (router.refresh)
// force-dynamic 페이지에서 실시간성 데이터(환율·시세) 를 주기적으로 새로 받기 위한 용도.
// tab 이 background 여도 modern 브라우저는 setInterval 을 유지(최소 1s throttle) — 10분 단위엔 영향 無.
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
