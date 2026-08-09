// ============================================================================
// /admin/cutting — 컷팅 로스 시뮬레이터 외부 사이트 리디렉션 라우트
// 클릭 시 새 탭에서 이 URL 진입 → 서버에서 시뮬레이터 도메인으로 즉시 리다이렉트
// super_admin / admin 만 접근 (미들웨어 권한 매트릭스 처리)
// ============================================================================

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CUTTING_APP_URL } from '@/lib/cutting';

export const dynamic = 'force-dynamic';

export default function CuttingRedirectPage() {
  if (CUTTING_APP_URL) {
    redirect(CUTTING_APP_URL);
  }
  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-6 text-white">
      <div className="max-w-md bg-[#171b26] border border-[#1f2433] rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">✂️</div>
        <h1 className="text-lg font-bold mb-2">컷팅 시뮬레이터 연결 미설정</h1>
        <p className="text-sm text-gray-400 mb-6">
          <code className="px-1.5 py-0.5 rounded bg-[#0f1117] text-[#c8962e]">CUTTING_APP_URL</code> 환경변수가 등록되지 않았습니다.
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
