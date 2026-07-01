'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { Mail, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isSupabaseConfigured } from '@/lib/env';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('Supabase 가 연결되지 않았습니다');
      return;
    }
    setBusy(true);

    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });

    if (error) {
      toast.error(`전송 실패: ${error.message}`);
      setBusy(false);
      return;
    }

    setSent(true);
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-4">
      <Toaster position="top-center" />

      <div className="w-full max-w-md bg-[#141823]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 ring-1 ring-[#c8962e]/15">
        <Link
          href="/login"
          className="text-xs text-gray-400 hover:text-white inline-flex items-center mb-4"
        >
          <ChevronLeft className="w-3 h-3" /> 로그인 페이지로
        </Link>

        <div className="text-center mb-6">
          <div className="text-3xl font-extrabold text-gold-gradient">OMWIS</div>
          <h1 className="text-base text-white mt-3 font-semibold">비밀번호 찾기</h1>
          <p className="text-xs text-gray-400 mt-1">
            계정 이메일을 입력하시면 재설정 링크를 보내드립니다
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <div className="text-sm text-green-300 font-semibold">전송 완료</div>
              <div className="text-xs text-gray-400 mt-2 leading-relaxed">
                <b>{email}</b> 로 재설정 이메일을 보냈습니다.<br />
                메일함 (스팸 폴더 포함) 을 확인해주세요.
              </div>
              <div className="text-[10px] text-gray-500 mt-3">
                💡 이메일이 안 오면 — 등록된 계정 이메일이 맞는지 확인 후 다시 시도하세요.
                여전히 안 되면 슈퍼관리자에게 비번 초기화를 요청하세요.
              </div>
            </div>
            <Link
              href="/login"
              className="block w-full text-center h-11 leading-[44px] rounded-lg bg-[#1a3d6b] hover:bg-[#235490] text-white text-sm font-semibold transition"
            >
              로그인 페이지로 돌아가기
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-gray-300">이메일</Label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="user@hongjee.co.kr"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white pl-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy || !email}
              className="w-full h-11 bg-gradient-to-r from-[#1a3d6b] to-[#2a5a96] hover:from-[#1f4a82] hover:to-[#316bb0] text-white"
            >
              {busy ? '전송 중...' : '재설정 이메일 받기'}
            </Button>

            <p className="text-[10px] text-gray-500 text-center leading-relaxed">
              ⚠️ Supabase 무료 티어는 시간당 4건 발송 제한이 있습니다.<br />
              긴급 시 슈퍼관리자(변지수 대표)에게 직접 비번 초기화를 요청하세요.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
