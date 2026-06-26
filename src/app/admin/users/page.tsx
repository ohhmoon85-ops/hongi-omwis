// ============================================================================
// /admin/users — 슈퍼관리자 전용 사용자 관리
// 미들웨어가 /admin/* 을 admin/super_admin 에 허용하지만, 페이지 내부에서
// super_admin 만 통과시킨다 (이중 게이트).
// ============================================================================

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserManager } from '@/components/admin/UserManager';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'super_admin') {
    redirect('/admin/dashboard?reason=super_admin_only');
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">사용자 관리</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
        <p className="text-sm text-gray-400 mt-1">
          전체 사용자 목록 + 비밀번호 초기화 (슈퍼관리자 전용)
        </p>
      </header>

      <UserManager />
    </div>
  );
}
