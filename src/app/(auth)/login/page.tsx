'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import toast, { Toaster } from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const reason = params.get('reason');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
      toast.error('Supabase 가 아직 연결되지 않았습니다 (.env.local 확인)');
      setLoading(false);
      return;
    }

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

    const role = profile?.role ?? 'customer';
    const home =
      role === 'chairman' ? '/chairman/monitor'
    : role === 'customer' ? '/customer/order'
    :                       '/admin/dashboard';

    router.push(home);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md bg-[#171b26] border border-[#1f2433] rounded-2xl p-8 shadow-2xl">
      <div className="mb-8 text-center">
        <div className="text-3xl font-bold text-[#c8962e] mb-2">OMWIS</div>
        <div className="text-sm text-gray-400">
          (주)홍지 폐쇄형 주문·배송·창고·재고 관리 시스템
        </div>
      </div>

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
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1"
            placeholder="user@hongi.co.kr"
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
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1a3d6b] hover:bg-[#235490] text-white"
        >
          {loading ? '로그인 중...' : '로그인'}
        </Button>
      </form>

      <div className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
        🔒 폐쇄형 시스템 — 자체 회원가입이 없습니다.<br />
        계정은 슈퍼 관리자(변지수 대표)가 직접 발급합니다.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] p-4">
      <Toaster position="top-center" />
      <Suspense fallback={<div className="text-gray-400">불러오는 중…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
