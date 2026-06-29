// ============================================================================
// /api/admin/users — 슈퍼관리자 전용 사용자 관리
//   GET  : 전체 사용자 목록 (auth.users + user_profiles 조인)
//   POST : 비번 초기화 { user_id, password }
// ⚠️ super_admin 만 접근 가능 — admin 도 차단
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: apiError('unauthorized') };
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') {
    return { error: apiError('forbidden', '슈퍼관리자만 사용자 관리에 접근할 수 있습니다') };
  }
  return { user };
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const admin = createAdminClient();

  // 모든 사용자 + 프로필 + 거래처명 조회
  // ⚠️ user_profiles.customer_id 에 FK 가 없어 PostgREST 임베드 조인 불가 →
  //    customers 를 따로 조회해 코드에서 매핑한다.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const [{ data: profiles }, { data: custList }] = await Promise.all([
    admin.from('user_profiles').select('id, role, name, customer_id'),
    admin.from('customers').select('id, company_name'),
  ]);

  const custName = new Map(
    (custList ?? []).map((c) => [c.id, c.company_name as string]),
  );

  const profileMap = new Map<string, {
    role: string; name: string | null; customer_id: string | null; company_name: string | null;
  }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, {
      role: p.role,
      name: p.name,
      customer_id: p.customer_id,
      company_name: p.customer_id ? custName.get(p.customer_id) ?? null : null,
    });
  }

  const users = (list?.users ?? []).map((u) => {
    const p = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      role: p?.role ?? null,
      name: p?.name ?? null,
      customer_id: p?.customer_id ?? null,
      company_name: p?.company_name ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    };
  }).sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard.error) return guard.error;

  const { user_id, password } = (await req.json()) as { user_id?: string; password?: string };
  if (!user_id) return apiError('validation', 'user_id 가 필요합니다');
  if (!password || password.length < 6) {
    return apiError('validation', '비밀번호는 최소 6자 이상이어야 합니다');
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user_id, { password });
  if (error) return apiError('internal', '비밀번호 초기화 실패', error.message);

  return NextResponse.json({ ok: true });
}
