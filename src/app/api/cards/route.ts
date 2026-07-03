// ============================================================================
// /api/cards — 명함(business_cards) CRUD
// POST  create (사진은 클라이언트가 Storage 에 올린 뒤 photo_path 만 전달)
// GET   list (?status=unprocessed|processed|discarded)
// PATCH update (id 는 쿼리스트링) — 상태 전환·업체 연결·메모·OCR 캐시
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

async function assertAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: apiError('unauthorized') };
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { error: apiError('forbidden', '관리자만 명함을 관리할 수 있습니다') };
  }
  return { user };
}

interface CardBody {
  photo_path?: string;
  event_name?: string | null;
  quick_memo?: string | null;
  captured_at?: string;
  status?: string;
  candidate_vendor_id?: string | null;
  ocr_result?: unknown;
}

export async function POST(req: NextRequest) {
  if (isDevMode) return apiError('validation', '개발 모드 미지원 (localStorage 사용)');

  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if ('error' in guard) return guard.error;

  const body = (await req.json()) as CardBody;
  if (!body.photo_path?.trim()) return apiError('validation', '사진 경로가 필요합니다');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('business_cards')
    .insert({
      photo_path: body.photo_path.trim(),
      event_name: body.event_name?.trim() || null,
      quick_memo: body.quick_memo?.trim() || null,
      captured_at: body.captured_at || new Date().toISOString(),
      status: 'unprocessed',
    })
    .select()
    .single();

  if (error || !data) return apiError('internal', '명함 저장 실패', error?.message);
  return NextResponse.json(data);
}

export async function GET(req: NextRequest) {
  if (isDevMode) return NextResponse.json([]);

  const supabase = createClient();
  const guard = await assertAdmin(supabase);
  if ('error' in guard) return guard.error;

  const status = req.nextUrl.searchParams.get('status');
  let q = supabase.from('business_cards').select('*');
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('captured_at', { ascending: false });
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

  const body = (await req.json()) as CardBody;
  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!['unprocessed', 'processed', 'discarded'].includes(body.status)) {
      return apiError('validation', '알 수 없는 상태입니다');
    }
    patch.status = body.status;
    patch.processed_at = body.status === 'processed' ? new Date().toISOString() : null;
  }
  if (body.candidate_vendor_id !== undefined) patch.candidate_vendor_id = body.candidate_vendor_id;
  if (body.quick_memo !== undefined) patch.quick_memo = (body.quick_memo ?? '').toString().trim() || null;
  if (body.event_name !== undefined) patch.event_name = (body.event_name ?? '').toString().trim() || null;
  if (body.ocr_result !== undefined) patch.ocr_result = body.ocr_result;

  if (Object.keys(patch).length === 0) return apiError('validation', '변경할 내용이 없습니다');

  const admin = createAdminClient();
  const { error } = await admin.from('business_cards').update(patch).eq('id', id);
  if (error) return apiError('internal', '명함 수정 실패', error.message);
  return NextResponse.json({ ok: true });
}
