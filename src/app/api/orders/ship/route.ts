// ============================================================================
// POST /api/orders/ship  — 출고 처리 (재고 차감 + 상태=shipped + 거래처 알림)
// ----------------------------------------------------------------------------
// 단일 액션으로 다음을 트랜잭션 보장:
//   1) 세금계산서 발행 여부 게이트
//   2) FIFO 재고 차감 (dispatch_order RPC) — 미차감 시에만
//   3) orders.status='shipped' 업데이트
//   4) 거래처에 '출고 안내' 알림 발송 (카카오톡 + 이메일)
//
// 권한: admin / super_admin 만 호출 가능.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notifications';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (isDevMode) {
    return apiError('validation', '개발 모드 미지원 (Supabase 연결 필요)');
  }

  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError('unauthorized');

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return apiError('forbidden', '관리자만 출고 처리할 수 있습니다');
  }

  const { order_id } = (await req.json()) as { order_id?: string };
  if (!order_id) return apiError('validation', 'order_id 누락');

  // ─ 1) 세금계산서 발행 여부 ─────────────────────────────────────────────
  const { data: inv } = await supabase
    .from('invoices').select('id')
    .eq('order_id', order_id)
    .in('status', ['issued', 'sent'])
    .limit(1);
  if (!inv || inv.length === 0) {
    return apiError('validation', '세금계산서 발행 후 출고할 수 있습니다');
  }

  // ─ 2) 중복 차감 방지 ──────────────────────────────────────────────────
  const { data: already } = await supabase
    .from('inventory_logs').select('id')
    .eq('order_id', order_id)
    .eq('log_type', 'out')
    .limit(1);
  const alreadyDispatched = !!already && already.length > 0;

  if (!alreadyDispatched) {
    const { error: dErr } = await supabase.rpc('dispatch_order', { p_order_id: order_id });
    if (dErr) return apiError('internal', '재고 차감 실패', dErr.message);
  }

  // ─ 3) 상태 변경 ───────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from('orders')
    .update({ status: 'shipped', updated_at: nowIso })
    .eq('id', order_id);
  if (upErr) return apiError('internal', '주문 상태 변경 실패', upErr.message);

  // ─ 4) 거래처 알림 발송 (실패해도 출고 성공으로 처리) ───────────────────
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select('order_number, customers(company_name, phone, email)')
      .eq('id', order_id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = (order as any)?.customers;
    if (customer?.phone || customer?.email) {
      await dispatchNotification({
        event: 'order_shipped',
        to: { phone: customer.phone ?? undefined, email: customer.email ?? undefined },
        variables: {
          order_number: order?.order_number ?? '-',
          shipped_at: nowIso,
        },
      });
    }
  } catch (err) {
    console.warn('[ship] notify failed (출고 자체는 성공):', err);
  }

  return NextResponse.json({ ok: true, status: 'shipped', restocked: false });
}
