// ============================================================================
// POST /api/biz/verify — 사업자등록번호 진위확인
// 관리자 권한 검증 후 국세청 API 또는 Mock 검증 결과 반환
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyBusinessNumber } from '@/lib/biz-verify';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('unauthorized');

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return apiError('forbidden', '관리자만 사업자번호 검증을 사용할 수 있습니다');
  }

  const { b_no } = (await req.json()) as { b_no?: string };
  if (!b_no) return apiError('validation', '사업자등록번호를 입력해주세요');

  const result = await verifyBusinessNumber(b_no);
  return NextResponse.json(result);
}
