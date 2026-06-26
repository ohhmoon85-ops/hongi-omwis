import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ACIS_APP_URL } from '@/lib/acis';
import { isDevMode } from '@/lib/dev-data';

export const dynamic = 'force-dynamic';

// ACIS 임베드는 슈퍼관리자 전용 — 일반 운영 관리자 접근 차단
async function currentRole(): Promise<string | null> {
  if (isDevMode) return 'super_admin';
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    return data?.role ?? null;
  } catch {
    return null;
  }
}

export default async function AcisEmbedPage() {
  const role = await currentRole();
  if (role !== 'super_admin') redirect('/admin/dashboard');

  return (
    <div className="h-screen flex flex-col bg-app text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1f2433] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-gray-400 hover:text-white" aria-label="대시보드로">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">🤖 ACIS 수입 인텔리전스</h1>
            <p className="text-xs text-gray-500">알루미늄 수입 의사결정 시스템 (실시간 임베드)</p>
          </div>
        </div>
        {ACIS_APP_URL && (
          <a
            href={ACIS_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c8962e] hover:bg-[#b3851f] text-white text-sm font-semibold transition"
          >
            새 탭으로 열기 <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </header>

      {ACIS_APP_URL ? (
        <iframe
          src={ACIS_APP_URL}
          title="ACIS 수입 인텔리전스"
          className="flex-1 w-full border-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          ACIS_API_URL 환경변수가 설정되지 않았습니다.
        </div>
      )}
    </div>
  );
}
