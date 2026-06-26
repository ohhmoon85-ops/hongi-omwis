'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Supabase 가 URL 의 # access_token 을 자동 파싱해서 PASSWORD_RECOVERY 이벤트 발생
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    // 페이지 직접 진입 시도 — 토큰 없으면 차단
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('재설정 링크가 유효하지 않거나 만료되었습니다. 비밀번호 찾기를 다시 요청해주세요.');
      } else {
        setReady(true);
      }
    }, 1200);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error('비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }
    if (pw !== confirm) {
      toast.error('비밀번호와 확인이 일치하지 않습니다');
      return;
    }
    setBusy(true);

    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password: pw });
    if (updErr) {
      toast.error(`변경 실패: ${updErr.message}`);
      setBusy(false);
      return;
    }

    setDone(true);
    setBusy(false);
    setTimeout(() => router.push('/login'), 2500);
  }

  if (error) {
    return (
      <div className="text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-300 mb-4">{error}</p>
        <Link
          href="/forgot-password"
          className="inline-block px-4 h-11 leading-[44px] rounded-lg bg-[#1a3d6b] hover:bg-[#235490] text-white text-sm font-semibold"
        >
          비밀번호 찾기 다시 요청
        </Link>
      </div>
    );
  }

  if (!ready) {
    return <div className="text-sm text-gray-400 text-center">링크 확인 중...</div>;
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <p className="text-sm text-green-300 font-semibold mb-2">비밀번호가 변경되었습니다</p>
        <p className="text-xs text-gray-400">잠시 후 로그인 페이지로 이동합니다...</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="pw" className="text-gray-300">새 비밀번호 (최소 6자)</Label>
        <div className="mt-1 relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            id="pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="bg-[#0f1117] border-[#2a2f3e] text-white pl-9"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="confirm" className="text-gray-300">새 비밀번호 확인</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="mt-1 bg-[#0f1117] border-[#2a2f3e] text-white"
        />
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="w-full h-11 bg-gradient-to-r from-[#1a3d6b] to-[#2a5a96] hover:from-[#1f4a82] hover:to-[#316bb0] text-white"
      >
        {busy ? '변경 중...' : '비밀번호 재설정'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md bg-[#141823]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 ring-1 ring-[#c8962e]/15">
        <div className="text-center mb-6">
          <div className="text-3xl font-extrabold text-gold-gradient">OMWIS</div>
          <h1 className="text-base text-white mt-3 font-semibold">비밀번호 재설정</h1>
        </div>
        <Suspense fallback={<div className="text-sm text-gray-400 text-center">불러오는 중...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
