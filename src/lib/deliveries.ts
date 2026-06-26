// ============================================================================
// 배송 데이터 레이어 — 배송기사/관리자 화면용 (브라우저 클라이언트, RLS 적용)
// 상태 변경은 service_role API(/api/deliveries) 경유 — driver 는 orders UPDATE
// 권한이 없어 배송완료 시 주문 동기화를 서버에서 처리해야 함.
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import type { Delivery } from '@/types';

export interface DeliveryView extends Delivery {
  order_number: string | null;
  memo?: string | null;
  scheduled_date: string | null;
  // 배송 기사 모바일 워크플로우 보조 — 전화/지도/사진
  customer_name: string | null;
  customer_phone: string | null;
}

export type DeliveryAction = 'depart' | 'complete';

export const DELIVERY_STATUS_BADGE: Record<
  Delivery['status'],
  { label: string; color: string }
> = {
  scheduled: { label: '배차 대기', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  departed:  { label: '배송 중',   color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  delivered: { label: '배송 완료', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  failed:    { label: '배송 실패', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

export async function fetchDeliveries(): Promise<DeliveryView[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, orders(order_number, customers(company_name, phone))')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((d: any) => ({
    ...d,
    order_number: d.orders?.order_number ?? null,
    customer_name: d.orders?.customers?.company_name ?? null,
    customer_phone: d.orders?.customers?.phone ?? null,
  }));
}

export async function driverAction(
  deliveryId: string,
  action: DeliveryAction,
): Promise<void> {
  const res = await fetch('/api/deliveries', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivery_id: deliveryId, action }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// 배송 완료 사진 path 를 deliveries.completion_photo_url 에 저장
export async function saveDeliveryPhotoPath(
  deliveryId: string,
  storagePath: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('deliveries')
    .update({
      completion_photo_url: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliveryId);
  if (error) throw new Error(error.message);
}
