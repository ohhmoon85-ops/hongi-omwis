// ============================================================================
// /admin/acis — ACIS 외부 사이트 리디렉션 라우트
// 클릭 시 새 탭에서 이 URL 진입 → 서버에서 ACIS 본 도메인으로 즉시 리다이렉트
// (iframe 방식 폐기: Vercel 보호 인증과 충돌)
// chairman / super_admin / admin 모두 접근 가능 — 미들웨어가 권한 매트릭스 처리
// ============================================================================

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ACIS_APP_URL } from '@/lib/acis';

export const dynamic = 'force-dynamic';

export default function AcisRedirectPage() {
  if (ACIS_APP_URL) {
    redirect(ACIS_APP_URL);
  }
  // ACIS_API_URL 미설정 시 안내 화면
  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-6 text-white">
      <div className="max-w-md bg-[#171b26] border border-[#1f2433] rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">🤖</div>
        <h1 className="text-lg font-bold mb-2">ACIS 연결 미설정</h1>
        <p className="text-sm text-gray-400 mb-6">
          <code className="px-1.5 py-0.5 rounded bg-[#0f1117] text-[#c8962e]">ACIS_API_URL</code> 환경변수가 Vercel 에 등록되지 않았습니다.
        </p>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center justify-center h-11 px-5 rounded-lg bg-[#1a3d6b] hover:bg-[#235490] text-white text-sm font-semibold"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    </div>
  );
}
