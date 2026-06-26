// ============================================================================
// 운영 모드 주문 데이터 레이어 — Supabase 브라우저 클라이언트 (RLS 적용)
// 클라이언트 컴포넌트에서 dev-orders(localStorage) 대신 사용.
// UI 는 기존 DevOrder 뷰 모델을 그대로 렌더하므로 같은 모양으로 매핑한다.
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import type { DevOrder } from '@/lib/dev-orders';
import type { OrderStatus } from '@/types';

// Supabase 조인 행 → UI 뷰 모델(DevOrder) 매핑
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderRow(row: any): DevOrder {
  return {
    id: row.id,
    order_number: row.order_number,
    customer_id: row.customer_id,
    customer_name: row.customers?.company_name ?? '-',
    status: row.status as OrderStatus,
    requested_date: row.requested_date,
    confirmed_date: row.confirmed_date ?? null,
    rejection_reason: row.rejection_reason ?? null,
    total_amount: row.total_amount ?? 0,
    paid_amount: row.paid_amount ?? 0,
    memo: row.memo ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (row.order_items ?? []).map((it: any) => ({
      product_id: it.product_id,
      product_name: it.products?.name ?? '-',
      quantity: Number(it.quantity),
      unit_price: it.unit_price,
      subtotal: it.subtotal,
    })),
  };
}

const ORDER_SELECT =
  '*, order_items(*, products(name)), customers(company_name)';

// 주문 목록 조회 — RLS 가 역할별 범위를 자동 필터 (admin=전체, customer=자사)
export async function fetchOrders(): Promise<DevOrder[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOrderRow);
}

// 주문 상태 변경 (관리자 승인/거절/진행) — RLS admin_all_orders 로 보호
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  patch?: { confirmed_date?: string; rejection_reason?: string },
): Promise<void> {
  const supabase = createClient();

  // 배송 시작 전 게이트: 세금계산서 발행 + FIFO 출고
  if (status === 'shipping') {
    // 1) 세금계산서 발행 여부
    const { data: inv } = await supabase
      .from('invoices')
      .select('id')
      .eq('order_id', orderId)
      .in('status', ['issued', 'sent'])
      .limit(1);
    if (!inv || inv.length === 0) {
      throw new Error('세금계산서 발행 후 배송을 시작할 수 있습니다.');
    }

    // 2) 이미 출고 처리되어 있는지 확인 — 중복 차감 방지
    const { data: already } = await supabase
      .from('inventory_logs')
      .select('id')
      .eq('order_id', orderId)
      .eq('log_type', 'out')
      .limit(1);

    // 3) 미출고 상태면 FIFO lot 차감 (Postgres 함수가 트랜잭션 보장)
    if (!already || already.length === 0) {
      const { error: dErr } = await supabase.rpc('dispatch_order', { p_order_id: orderId });
      if (dErr) throw new Error(dErr.message);
    }
  }

  const { error } = await supabase
    .from('orders')
    .update({ status, ...patch, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw new Error(error.message);

  // '배송 시작' 시 배송 레코드 자동 생성 (없을 때만)
  if (status === 'shipping') await ensureDelivery(orderId);
}

// 주문에 연결된 배송 레코드가 없으면 생성 — 거래처 배송지·확정 납기 복사
async function ensureDelivery(orderId: string): Promise<void> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('deliveries').select('id').eq('order_id', orderId).limit(1);
  if (existing && existing.length > 0) return;

  const { data: order } = await supabase
    .from('orders')
    .select('confirmed_date, requested_date, customers(delivery_address)')
    .eq('id', orderId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = (order as any)?.customers;
  await supabase.from('deliveries').insert({
    order_id: orderId,
    status: 'scheduled',
    scheduled_date: order?.confirmed_date ?? order?.requested_date ?? null,
    delivery_address: customer?.delivery_address ?? null,
  });
}

// 수동 출고 처리 — 상태 변경 없이 dispatch_order(FIFO 차감) 만 실행.
// 사용 예: 세금계산서 발행 전 미리 출고하거나, 외상 거래 등 별도 경로.
// 멱등: 이미 출고된 주문이면 에러 던짐 (중복 차감 방지).
export async function dispatchOrderManually(orderId: string): Promise<void> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('inventory_logs')
    .select('id')
    .eq('order_id', orderId)
    .eq('log_type', 'out')
    .limit(1);
  if (existing && existing.length > 0) {
    throw new Error('이미 출고 처리된 주문입니다.');
  }

  const { error } = await supabase.rpc('dispatch_order', { p_order_id: orderId });
  if (error) throw new Error(error.message);
}

// 어떤 주문들이 이미 출고(=재고 차감)되었는지 — UI 배지 표시용
export async function fetchDispatchedOrderIds(): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_logs')
    .select('order_id')
    .eq('log_type', 'out')
    .not('order_id', 'is', null);
  if (error) {
    console.warn('[orders] dispatched ids fetch failed:', error.message);
    return new Set();
  }
  const ids = new Set<string>();
  for (const r of data ?? []) if (r.order_id) ids.add(r.order_id);
  return ids;
}

// 거래처 재주문 — 기존 품목으로 신규 주문 생성 (서버 API 경유: 주문번호·알림 처리)
export async function reorder(order: DevOrder): Promise<string> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: order.items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
      requested_date: order.requested_date,
      memo: order.memo ?? undefined,
    }),
  });
  if (!res.ok) {
    const { readApiError } = await import('@/lib/api-error');
    throw new Error(await readApiError(res));
  }
  const data = await res.json();
  return data.order_number as string;
}
