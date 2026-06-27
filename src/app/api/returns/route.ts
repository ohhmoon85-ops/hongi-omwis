// ============================================================================
// POST /api/returns  — 반품 처리
// ----------------------------------------------------------------------------
// 출고 완료(shipped) 된 주문에 대해 반품 사유 기록 + (옵션) 재고 복원.
//
// 절차:
//   1) 권한 (admin/super_admin)
//   2) 주문이 'shipped' 상태인지 확인 (다른 상태 반품 불가)
//   3) returns 테이블에 사유 기록
//   4) restock=true 면 inventory_logs(in, memo='return') + 동명 lot 에 수량 가산
//      (간단화: 첫 active lot 또는 신규 lot 'RET-{order_number}' 에 추가)
//   5) orders.status='returned' 변경
//   6) 관리자에게 반품 접수 알림 (audit)
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notifications';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

interface ReturnBody {
  order_id?: string;
  reason?: string;
  restock?: boolean;
  memo?: string;
}

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
    return apiError('forbidden', '관리자만 반품 처리할 수 있습니다');
  }

  const body = (await req.json()) as ReturnBody;
  const { order_id, reason, restock = false, memo } = body;
  if (!order_id || !reason?.trim()) {
    return apiError('validation', 'order_id 와 reason 은 필수입니다');
  }

  const admin = createAdminClient();

  // ─ 1) 주문 상태 확인 ──────────────────────────────────────────────────
  const { data: order, error: oErr } = await admin
    .from('orders')
    .select('id, order_number, status, customer_id, customers(company_name)')
    .eq('id', order_id)
    .single();
  if (oErr || !order) return apiError('not_found', '주문을 찾을 수 없습니다');
  if (order.status !== 'shipped') {
    return apiError('validation', '출고 완료 상태의 주문만 반품할 수 있습니다');
  }

  // ─ 2) returns 인서트 ──────────────────────────────────────────────────
  const { error: rErr } = await admin.from('returns').insert({
    order_id,
    reason: reason.trim(),
    restock,
    memo: memo ?? null,
    created_by: user.id,
  });
  if (rErr) return apiError('internal', '반품 이력 저장 실패', rErr.message);

  // ─ 3) 재고 복원 (옵션) ────────────────────────────────────────────────
  if (restock) {
    const { data: items } = await admin
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order_id);

    for (const it of items ?? []) {
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) continue;

      // 활성 lot 1개 찾아서 거기에 가산 — 없으면 RET-{order_number} 새 lot 생성
      const { data: lot } = await admin
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', it.product_id)
        .eq('status', 'active')
        .order('import_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      let inventoryId: string | null = null;
      if (lot) {
        inventoryId = lot.id;
        await admin
          .from('inventory')
          .update({ quantity: Number(lot.quantity) + qty, updated_at: new Date().toISOString() })
          .eq('id', lot.id);
      } else {
        const { data: created } = await admin
          .from('inventory')
          .insert({
            product_id: it.product_id,
            lot_number: `RET-${order.order_number}`,
            quantity: qty,
            initial_quantity: qty,
            import_date: new Date().toISOString().slice(0, 10),
            status: 'active',
          })
          .select('id')
          .single();
        inventoryId = created?.id ?? null;
      }

      // inventory_logs 기록 (반품 입고)
      await admin.from('inventory_logs').insert({
        inventory_id: inventoryId,
        product_id: it.product_id,
        log_type: 'in',
        quantity: qty,
        order_id,
        memo: `반품 입고 (${reason.trim()})`,
        created_by: user.id,
      });
    }
  }

  // ─ 4) 주문 상태 → returned ────────────────────────────────────────────
  await admin
    .from('orders')
    .update({ status: 'returned', updated_at: new Date().toISOString() })
    .eq('id', order_id);

  // ─ 5) 관리자 알림 (audit) ────────────────────────────────────────────
  try {
    const { data: admins } = await admin
      .from('user_profiles').select('id').in('role', ['super_admin', 'admin']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyName = (order as any).customers?.company_name ?? '-';
    for (const a of admins ?? []) {
      const { data: { user: au } } = await admin.auth.admin.getUserById(a.id);
      if (au?.email) {
        await dispatchNotification({
          event: 'order_returned',
          to: { email: au.email },
          variables: {
            company_name: companyName,
            order_number: order.order_number,
            reason: reason.trim(),
            restock: restock ? 'yes' : 'no',
            restock_label: restock ? '예 (정상품)' : '아니오 (폐기)',
          },
        });
      }
    }
  } catch (err) {
    console.warn('[returns] notify failed (반품 자체는 성공):', err);
  }

  return NextResponse.json({ ok: true, restocked: restock });
}
