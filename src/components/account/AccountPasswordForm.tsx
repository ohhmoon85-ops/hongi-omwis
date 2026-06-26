'use client';

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

interface Props { userEmail: string }

export function AccountPasswordForm({ userEmail }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (next.length < 6) {
      toast.error('새 비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }
    if (next !== confirm) {
      toast.error('새 비밀번호와 확인이 일치하지 않습니다');
      return;
    }
    if (current === next) {
      toast.error('현재 비밀번호와 동일합니다');
      return;
    }

    setBusy(true);
    const supabase = createClient();

    try {
      // 1) 현재 비번 재확인 — 세션 탈취 방어
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: current,
      });
      if (signInErr) {
        toast.error('현재 비밀번호가 올바르지 않습니다');
        setBusy(false);
        return;
      }

      // 2) 비번 갱신
      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) {
        toast.error(`변경 실패: ${updErr.message}`);
        setBusy(false);
        return;
      }

      toast.success('비밀번호가 변경되었습니다');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toaster position="top-center" />
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="current" className="text-xs text-gray-400">현재 비밀번호</Label>
          <Input
            id="current"
            type={showPw ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 bg-[#0f1117] border-[#2a2f3e] text-white"
          />
        </div>
        <div>
          <Label htmlFor="next" className="text-xs text-gray-400">새 비밀번호 (최소 6자)</Label>
          <Input
            id="next"
            type={showPw ? 'text' : 'password'}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 bg-[#0f1117] border-[#2a2f3e] text-white"
          />
        </div>
        <div>
          <Label htmlFor="confirm" className="text-xs text-gray-400">새 비밀번호 확인</Label>
          <Input
            id="confirm"
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="mt-1 bg-[#0f1117] border-[#2a2f3e] text-white"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="text-[11px] text-gray-500 hover:text-gray-300 inline-flex items-center gap-1"
          >
            {showPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            비밀번호 {showPw ? '숨기기' : '표시'}
          </button>
          <Button
            type="submit"
            disabled={busy}
            className="bg-[#1a3d6b] hover:bg-[#235490] text-white"
          >
            {busy ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </div>

        <p className="text-[10px] text-gray-500 mt-2">
          💡 비밀번호를 잊으신 경우 로그아웃 → 로그인 페이지의「비밀번호 찾기」 사용.
        </p>
      </form>
    </>
  );
}
