// ============================================================================
// POST /api/vendors/promote — 후보 업체 승격 / 탈락 / 보류
// ----------------------------------------------------------------------------
// body: { id, action: 'approve'|'reject'|'hold', memo? }
// - approve: status='approved' + approved_at + approved_by 기록
// - reject : status='rejected' + memo 에 사유
// - hold   : status='on_hold' + memo
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (isDevMode) return apiError('validation', '개발 모드 미지원');

  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError('unauthorized');

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return apiError('forbidden', '관리자만 승격/탈락 처리할 수 있습니다');
  }

  const { id, action, memo } = (await req.json()) as {
    id?: string;
    action?: 'approve' | 'reject' | 'hold';
    memo?: string;
  };
  if (!id || !action) return apiError('validation', 'id 와 action 필수');

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { updated_at: now, memo: memo?.trim() || null };
  if (action === 'approve') {
    patch.status = 'approved';
    patch.approved_at = now;
    patch.approved_by = user.id;
  } else if (action === 'reject') {
    patch.status = 'rejected';
  } else {
    patch.status = 'on_hold';
  }

  const { error } = await admin.from('candidate_vendors').update(patch).eq('id', id);
  if (error) return apiError('internal', '처리 실패', error.message);

  return NextResponse.json({ ok: true, status: patch.status });
}
