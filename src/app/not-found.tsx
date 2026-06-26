// ============================================================================
// 전역 404 — 어떤 경로에서든 페이지 미존재 시 표시
// ============================================================================

import Link from 'next/link';
import { Search, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#171b26] border border-white/[0.06] rounded-2xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#c8962e]/15 flex items-center justify-center">
          <Search className="w-7 h-7 text-[#c8962e]" />
        </div>
        <div className="text-5xl font-extrabold text-gold-gradient mb-2">404</div>
        <h1 className="text-xl font-bold text-white mb-2">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray-400 mb-6">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-1.5 px-5 h-11 rounded-lg bg-[#1a3d6b] hover:bg-[#235490] text-white text-sm font-semibold"
        >
          <Home className="w-4 h-4" />
          로그인 페이지로
        </Link>
      </div>
    </div>
  );
}
