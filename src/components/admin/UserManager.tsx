'use client';

import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Key, RefreshCw, Search, Eye, EyeOff, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';
import { ROLE_LABEL, type UserRole } from '@/types';
import { readApiError } from '@/lib/api-error';

interface UserRow {
  id: string;
  email: string | null;
  role: string | null;
  name: string | null;
  customer_id: string | null;
  company_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const ROLE_BADGE: Record<string, string> = {
  chairman:    'bg-[#c8962e]/15 text-[#c8962e] border-[#c8962e]/30',
  super_admin: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  admin:       'bg-purple-500/15 text-purple-300 border-purple-500/30',
  driver:      'bg-orange-500/15 text-orange-300 border-orange-500/30',
  customer:    'bg-green-500/15 text-green-300 border-green-500/30',
};

export function UserManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<UserRole | 'all'>('all');
  const [query, setQuery] = useState('');
  const [resetting, setResetting] = useState<UserRow | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      setUsers(data.users as UserRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, []);

  let filtered = users;
  if (filter !== 'all') filtered = filtered.filter((u) => u.role === filter);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((u) =>
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.company_name?.toLowerCase().includes(q),
    );
  }

  const roleCount = (r: string) => users.filter((u) => u.role === r).length;

  return (
    <>
      <Toaster position="top-center" />

      {/* 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4">
        {(['all', 'chairman', 'super_admin', 'admin', 'driver', 'customer'] as Array<UserRole | 'all'>).map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-2 rounded-lg text-xs border transition ${
              filter === r
                ? 'bg-[#1a3d6b] text-white border-[#1a3d6b]'
                : 'bg-[#171b26] text-gray-300 border-[#2a2f3e] hover:border-[#1a3d6b]'
            }`}
          >
            <div className="font-semibold">
              {r === 'all' ? '전체' : ROLE_LABEL[r]}
            </div>
            <div className="text-[10px] opacity-70 mt-0.5">
              {r === 'all' ? users.length : roleCount(r)}명
            </div>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이메일/이름/거래처명 검색"
            className="bg-[#171b26] border-[#2a2f3e] text-white pl-9"
          />
        </div>
        <button
          onClick={load}
          className="p-2 text-gray-400 hover:text-white"
          aria-label="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 목록 */}
      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#171b26] border-[#1f2433]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            조건에 맞는 사용자가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#171b26] border-[#1f2433]">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[#0f1117]">
                <tr className="text-xs text-gray-400">
                  <th className="text-left py-2.5 px-3 font-normal">역할</th>
                  <th className="text-left py-2.5 px-3 font-normal">이메일</th>
                  <th className="text-left py-2.5 px-3 font-normal">이름</th>
                  <th className="text-left py-2.5 px-3 font-normal">거래처</th>
                  <th className="text-left py-2.5 px-3 font-normal w-32">최근 로그인</th>
                  <th className="text-right py-2.5 px-3 font-normal w-32">작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-[#1f2433] hover:bg-white/[0.02]">
                    <td className="py-2 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ROLE_BADGE[u.role ?? ''] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                        {u.role ? ROLE_LABEL[u.role as UserRole] : '없음'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-200 font-mono text-xs">{u.email}</td>
                    <td className="py-2 px-3 text-gray-300">{u.name ?? '-'}</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">{u.company_name ?? '-'}</td>
                    <td className="py-2 px-3 text-gray-500 text-[11px]">
                      {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setResetting(u)}
                        className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 px-2 py-1 rounded border border-blue-500/30 hover:bg-blue-500/10"
                      >
                        <Key className="w-3 h-3" />
                        비번 초기화
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 비번 초기화 모달 */}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => { setResetting(null); load(); }}
        />
      )}
    </>
  );
}

function ResetPasswordModal({
  user, onClose, onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pw, setPw] = useState('omwis1234');
  const [showPw, setShowPw] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw.length < 6) {
      toast.error('비밀번호는 최소 6자 이상');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, password: pw }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      toast.success(`${user.email} 비번이 변경되었습니다`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '변경 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171b26] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white inline-flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-300" />
            비밀번호 초기화
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 text-sm">
          <div className="text-gray-400">대상 사용자:</div>
          <div className="font-mono text-white">{user.email}</div>
          {user.name && <div className="text-xs text-gray-500 mt-0.5">{user.name}</div>}
        </div>

        <div>
          <Label className="text-xs text-gray-400">새 비밀번호 (기본값: omwis1234, 최소 6자)</Label>
          <div className="mt-1 flex gap-2">
            <Input
              type={showPw ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={6}
              autoFocus
              className="flex-1 bg-[#0f1117] border-[#2a2f3e] text-white font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="p-2 text-gray-400 hover:text-white border border-[#2a2f3e] rounded"
              aria-label="비번 표시 전환"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            💡 사용자에게 새 비밀번호를 안전한 방법으로 전달해주세요.
            전달 후 사용자가 직접 /account 에서 다시 변경하길 권장합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button onClick={onClose} variant="outline" disabled={busy}>취소</Button>
          <Button
            onClick={submit}
            disabled={busy || pw.length < 6}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? '변경 중...' : '비번 변경'}
          </Button>
        </div>
      </div>
    </div>
  );
}
