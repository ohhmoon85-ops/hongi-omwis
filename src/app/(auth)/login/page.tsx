'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import toast, { Toaster } from 'react-hot-toast';
import type { UserRole } from '@/types';
import { isDevMode } from '@/lib/env';

const ROLE_HOME: Record<UserRole, string> = {
  chairman:    '/chairman/monitor',
  super_admin: '/admin/dashboard',
  admin:       '/admin/dashboard',
  driver:      '/admin/deliveries',
  customer:    '/customer/order',
};

function setMockRoleCookie(role: UserRole) {
  // 7일 유지, 서버 컴포넌트/미들웨어에서 읽기 가능
  document.cookie = `dev_mock_role=${role}; path=/; max-age=${7 * 24 * 60 * 60}`;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const reason = params.get('reason');

  function devLoginAs(role: UserRole) {
    setMockRoleCookie(role);
    router.push(ROLE_HOME[role]);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // ─── 개발 모드: 1234/1234 우회 ────────────────────────────────
    if (isDevMode) {
      if (email === '1234' && password === '1234') {
        devLoginAs('super_admin');
        return;
      }
      toast.error('개발 모드: 이메일·비밀번호 모두 1234');
      setLoading(false);
      return;
    }

    // ─── 운영 모드: Supabase 인증 ─────────────────────────────────
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password,
    });

    if (error || !data.user) {
      toast.error(error?.message ?? '로그인 실패');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', data.user.id).single();

    const role = (profile?.role ?? 'customer') as UserRole;
    router.push(ROLE_HOME[role]);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md bg-[#141823]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 card-elevated ring-1 ring-[#c8962e]/15">
      <div className="mb-8 text-center">
        <div className="text-5xl font-extrabold tracking-tight text-gold-gradient mb-2">OMWIS</div>
        <div className="text-sm text-gray-400 tracking-wide">
          (주)홍지 폐쇄형 주문·배송·창고·재고 관리 시스템
        </div>
        <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-[#c8962e]/60 to-transparent" />
      </div>

      {isDevMode && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs leading-relaxed">
          🛠️ <b>개발 모드</b> — Supabase 미연결.<br />
          이메일·비밀번호 모두 <code className="px-1 bg-amber-500/20 rounded">1234</code> 입력 또는 아래 역할 버튼을 누르세요.
        </div>
      )}

      {reason === 'forbidden' && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          해당 페이지에 접근 권한이 없습니다.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="text-gray-300">이메일</Label>
          <Input
            id="email"
            // 개발 모드에서는 "1234" 입력 허용을 위해 text 타입
            type={isDevMode ? 'text' : 'email'}
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1"
            placeholder={isDevMode ? '1234' : 'user@hongi.co.kr'}
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-gray-300">비밀번호</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1"
            placeholder={isDevMode ? '1234' : ''}
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-[#1a3d6b] to-[#2a5a96] hover:from-[#1f4a82] hover:to-[#316bb0] text-white shadow-lg shadow-[#1a3d6b]/30"
        >
          {loading ? '로그인 중...' : '로그인'}
        </Button>

        <div className="text-center pt-1">
          <a
            href="/forgot-password"
            className="text-xs text-gray-500 hover:text-[#c8962e] underline-offset-2 hover:underline"
          >
            비밀번호를 잊으셨나요?
          </a>
        </div>
      </form>

      {isDevMode && (
        <div className="mt-6 pt-5 border-t border-[#1f2433]">
          <div className="text-[11px] text-gray-500 mb-2 text-center">
            ⚡ 빠른 역할 전환 (개발 전용)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <DevRoleButton onClick={() => devLoginAs('chairman')}    label="👑 회장" />
            <DevRoleButton onClick={() => devLoginAs('super_admin')} label="🔑 슈퍼" />
            <DevRoleButton onClick={() => devLoginAs('admin')}       label="📋 운영" />
            <DevRoleButton onClick={() => devLoginAs('driver')}      label="🚛 배송" />
            <DevRoleButton onClick={() => devLoginAs('customer')}    label="🏢 거래처" />
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
        🔒 폐쇄형 시스템 — 자체 회원가입이 없습니다.<br />
        계정은 슈퍼 관리자(변지수 대표)가 직접 발급합니다.
      </div>
    </div>
  );
}

function DevRoleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-2 text-xs rounded-md bg-[#0f1117] border border-[#2a2f3e] text-gray-300 hover:bg-[#1a3d6b] hover:border-[#235490] hover:text-white transition"
    >
      {label}
    </button>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-4">
      <Toaster position="top-center" />
      <Suspense fallback={<div className="text-gray-400">불러오는 중…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
