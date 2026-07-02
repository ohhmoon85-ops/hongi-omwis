// ============================================================================
// /api/vendors — 후보 업체 CRUD
// POST  create + return row
// GET   list (status 필터 옵션: ?status=evaluating|approved|rejected|on_hold)
// PATCH update (id 는 쿼리스트링)
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

interface VendorBody {
  name?: string;
  location?: string;
  contact_name?: string;
  wechat?: string;
  phone?: string;
  email?: string;
  price_note?: string;
  moq?: string;
  lead_time?: string;
  payment_terms?: string;
  factory_note?: string;
  memo?: string;
}

async function assertAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: apiError('unauthorized') };
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { error: apiError('forbidden', '관리자만 후보 업체를 관리할 수 있습니다') };
  }
  return { user };
}

export async function POST(req: NextRequest) {
  if (isDevMode) return apiError('validation', '개발 모드 미지원 (localStorage 사용)');

  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if ('error' in guard) return guard.error;

  const body = (await req.json()) as VendorBody;
  if (!body.name?.trim()) return apiError('validation', '업체명은 필수입니다');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('candidate_vendors')
    .insert({
      name: body.name.trim(),
      location: body.location?.trim() || null,
      contact_name: body.contact_name?.trim() || null,
      wechat: body.wechat?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      price_note: body.price_note?.trim() || null,
      moq: body.moq?.trim() || null,
      lead_time: body.lead_time?.trim() || null,
      payment_terms: body.payment_terms?.trim() || null,
      factory_note: body.factory_note?.trim() || null,
    })
    .select()
    .single();

  if (error || !data) return apiError('internal', '업체 등록 실패', error?.message);
  return NextResponse.json(data);
}

export async function GET(req: NextRequest) {
  if (isDevMode) return NextResponse.json([]);

  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if ('error' in guard) return guard.error;

  const status = req.nextUrl.searchParams.get('status');
  let q = supabase.from('candidate_vendors').select('*');
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return apiError('internal', '조회 실패', error.message);
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  if (isDevMode) return apiError('validation', '개발 모드 미지원');

  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if ('error' in guard) return guard.error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return apiError('validation', 'id 파라미터 필수');

  const body = (await req.json()) as VendorBody;
  const admin = createAdminClient();
  const { error } = await admin
    .from('candidate_vendors')
    .update({
      ...Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? (v.trim() || null) : v]),
      ),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return apiError('internal', '업체 수정 실패', error.message);
  return NextResponse.json({ ok: true });
}
