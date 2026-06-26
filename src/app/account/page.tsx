// ============================================================================
// /account — 내 계정 (모든 역할 접근 가능)
// 본인 비밀번호 변경 + 기본 프로필 표시
// ============================================================================

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, User, Mail, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ROLE_LABEL, type UserRole } from '@/types';
import { LogoutButton } from '@/components/shared/LogoutButton';
import { AccountPasswordForm } from '@/components/account/AccountPasswordForm';

export const dynamic = 'force-dynamic';

const ROLE_HOME: Record<UserRole, string> = {
  chairman:    '/chairman/monitor',
  super_admin: '/admin/dashboard',
  admin:       '/admin/dashboard',
  driver:      '/admin/deliveries',
  customer:    '/customer/order',
};

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('role, name, customer_id').eq('id', user.id).single();

  const role = (profile?.role ?? 'customer') as UserRole;
  const home = ROLE_HOME[role];

  let customerName: string | null = null;
  if (profile?.customer_id) {
    const { data: c } = await supabase
      .from('customers').select('company_name').eq('id', profile.customer_id).single();
    customerName = c?.company_name ?? null;
  }

  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <header className="mb-6 max-w-2xl flex items-start justify-between gap-3">
        <div>
          <Link
            href={home}
            className="text-xs text-gray-400 hover:text-white inline-flex items-center"
          >
            <ChevronLeft className="w-3 h-3" /> 돌아가기
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2">내 계정</h1>
          <p className="text-sm text-gray-400 mt-1">
            프로필 정보 확인 + 비밀번호 변경
          </p>
        </div>
        <LogoutButton variant="dark" />
      </header>

      <div className="max-w-2xl space-y-4">
        {/* 프로필 정보 */}
        <div className="bg-[#171b26] border border-[#1f2433] rounded-lg p-5 space-y-3">
          <div className="text-xs text-gray-400 font-semibold mb-2">📇 기본 정보</div>
          <Row icon={<User className="w-4 h-4" />} label="이름" value={profile?.name ?? '-'} />
          <Row icon={<Mail className="w-4 h-4" />} label="이메일" value={user.email ?? '-'} />
          <Row icon={<Shield className="w-4 h-4" />} label="역할" value={ROLE_LABEL[role]} />
          {customerName && (
            <Row icon={<span className="w-4 text-center">🏢</span>} label="거래처" value={customerName} />
          )}
        </div>

        {/* 비번 변경 */}
        <div className="bg-[#171b26] border border-[#1f2433] rounded-lg p-5">
          <div className="text-xs text-gray-400 font-semibold mb-3">🔐 비밀번호 변경</div>
          <AccountPasswordForm userEmail={user.email ?? ''} />
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-[#1f2433] last:border-0">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-gray-100 font-medium">{value}</div>
    </div>
  );
}
