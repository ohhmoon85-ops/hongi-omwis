'use client';

// ============================================================================
// 로그아웃 버튼 — 회장/거래처 페이지처럼 AdminNav 가 없는 화면에서 사용
// ============================================================================

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  variant?: 'dark' | 'light';
  className?: string;
  showLabel?: boolean;
}

export function LogoutButton({ variant = 'dark', className = '', showLabel = true }: Props) {
  const router = useRouter();

  async function logout() {
    try {
      await createClient().auth.signOut();
    } catch {
      // dev 모드 — Supabase 미설정
    }
    // dev_mock_role 쿠키도 정리
    document.cookie = 'dev_mock_role=; path=/; max-age=0';
    router.push('/login');
    router.refresh();
  }

  const styles = variant === 'dark'
    ? 'text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.06]'
    : 'text-gray-600 hover:text-[#1a3d6b] hover:bg-[#1a3d6b]/[0.05] border border-[#1a3d6b]/15';

  return (
    <button
      onClick={logout}
      className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm transition ${styles} ${className}`}
      aria-label="로그아웃"
    >
      <LogOut className="w-4 h-4" />
      {showLabel && <span>로그아웃</span>}
    </button>
  );
}
