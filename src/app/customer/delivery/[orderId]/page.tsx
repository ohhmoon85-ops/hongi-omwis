// ============================================================================
// /customer/delivery/[orderId] — 거래처 배송 추적
// RLS: cust_read_own_orders / cust_read_own_deliveries 가 자동으로 본인 데이터만
// ============================================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatKRW, formatDate, formatDateTime } from '@/lib/utils';
import { ORDER_STATUS_BADGE, type OrderStatus } from '@/types';
import { CompletionPhotoView } from '@/components/customer/CompletionPhotoView';

interface PageProps { params: { orderId: string } }

interface DeliveryRow {
  id: string;
  status: 'scheduled' | 'departed' | 'delivered' | 'failed';
  scheduled_date: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  delivery_address: string | null;
  completion_photo_url: string | null;
  driver_name: string | null;
  driver_phone: string | null;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: OrderStatus;
  requested_date: string | null;
  confirmed_date: string | null;
  total_amount: number;
  memo: string | null;
  created_at: string;
  items: Array<{ name: string; quantity: number; unit_price: number; subtotal: number }>;
  delivery: DeliveryRow | null;
}

async function loadOrder(orderId: string): Promise<OrderDetail | null> {
  const supabase = createClient();

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, requested_date, confirmed_date,
      total_amount, memo, created_at,
      order_items(quantity, unit_price, subtotal, products(name))
    `)
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;

  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, status, scheduled_date, departure_time, arrival_time, delivery_address, completion_photo_url, driver_name, driver_phone')
    .eq('order_id', orderId)
    .maybeSingle();

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status as OrderStatus,
    requested_date: order.requested_date,
    confirmed_date: order.confirmed_date,
    total_amount: order.total_amount ?? 0,
    memo: order.memo,
    created_at: order.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: ((order as any).order_items ?? []).map((it: any) => ({
      name: it.products?.name ?? '품목',
      quantity: Number(it.quantity),
      unit_price: it.unit_price,
      subtotal: it.subtotal,
    })),
    delivery: (delivery as DeliveryRow) ?? null,
  };
}

// 5단계 진행 — pending/approved/processing → 처리중,
// ready → 출고준비, shipping → 배송중, delivered → 완료
const STEPS = [
  { key: 'received',   label: '주문 접수',  match: ['pending', 'approved'] as OrderStatus[] },
  { key: 'processing', label: '처리 중',    match: ['processing'] as OrderStatus[] },
  { key: 'ready',      label: '출고 준비',  match: ['ready'] as OrderStatus[] },
  { key: 'shipping',   label: '배송 중',    match: ['shipping'] as OrderStatus[] },
  { key: 'delivered',  label: '배송 완료',  match: ['delivered'] as OrderStatus[] },
];

function currentStepIndex(status: OrderStatus): number {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (STEPS[i].match.includes(status)) return i;
  }
  return 0;
}

export default async function CustomerDeliveryPage({ params }: PageProps) {
  const order = await loadOrder(params.orderId);
  if (!order) notFound();

  const stepIdx = currentStepIndex(order.status);
  const badge = ORDER_STATUS_BADGE[order.status];

  // 거절/취소 상태일 때는 별도 표시
  const aborted = order.status === 'cancelled' || order.status === 'rejected';

  return (
    <div className="min-h-screen bg-app-light p-4 sm:p-6 text-[#1c1c1c]">
      <header className="mb-6 max-w-3xl">
        <Link
          href="/customer/orders"
          className="text-xs text-gray-500 hover:text-[#1a3d6b] inline-flex items-center"
        >
          <ChevronLeft className="w-3 h-3" /> 주문 내역
        </Link>
        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold">{order.order_number}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          주문일 {formatDate(order.created_at)} ·
          납기 요청 {formatDate(order.requested_date)}
          {order.confirmed_date && ` · 확정 납기 ${formatDate(order.confirmed_date)}`}
        </p>
      </header>

      <div className="max-w-3xl space-y-4">
        {/* 5단계 진행바 */}
        {!aborted && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="text-xs text-gray-500 mb-3 font-semibold">📦 배송 진행</div>
            {/* 데스크톱: 가로 / 모바일: 세로 */}
            <div className="hidden sm:flex items-center">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      i < stepIdx ? 'bg-green-500 text-white'
                      : i === stepIdx ? 'bg-[#1a3d6b] text-white ring-4 ring-[#1a3d6b]/15'
                      : 'bg-gray-100 text-gray-400'
                    }`}>
                      {i < stepIdx ? '✓' : i + 1}
                    </div>
                    <div className={`text-[11px] mt-1.5 ${i <= stepIdx ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                      {s.label}
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded-full ${
                      i < stepIdx ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            {/* 모바일: 세로 스택 */}
            <ol className="sm:hidden space-y-3">
              {STEPS.map((s, i) => (
                <li key={s.key} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    i < stepIdx ? 'bg-green-500 text-white'
                    : i === stepIdx ? 'bg-[#1a3d6b] text-white ring-4 ring-[#1a3d6b]/15'
                    : 'bg-gray-100 text-gray-400'
                  }`}>
                    {i < stepIdx ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm ${i <= stepIdx ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                  {i === stepIdx && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a3d6b]/10 text-[#1a3d6b]">
                      현재
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {aborted && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-red-700">
              {order.status === 'rejected' ? '주문이 거절되었습니다' : '주문이 취소되었습니다'}
            </div>
          </div>
        )}

        {/* 배송 상세 */}
        {order.delivery && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="text-xs text-gray-500 mb-3 font-semibold">🚚 배송 상세</div>
            <div className="space-y-2 text-sm">
              {order.delivery.delivery_address && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">배송지</span>
                  <span className="text-right break-keep">{order.delivery.delivery_address}</span>
                </div>
              )}
              {order.delivery.driver_name && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">배송 담당</span>
                  <span>{order.delivery.driver_name}</span>
                </div>
              )}
              {order.delivery.scheduled_date && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">출고 예정</span>
                  <span>{formatDate(order.delivery.scheduled_date)}</span>
                </div>
              )}
              {order.delivery.departure_time && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">출발 시각</span>
                  <span>{formatDateTime(order.delivery.departure_time)}</span>
                </div>
              )}
              {order.delivery.arrival_time && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">도착 시각</span>
                  <span className="text-green-700 font-semibold">
                    {formatDateTime(order.delivery.arrival_time)}
                  </span>
                </div>
              )}
            </div>

            {/* 완료 사진 */}
            {order.delivery.completion_photo_url && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2 font-semibold">📷 배송 완료 사진</div>
                <CompletionPhotoView path={order.delivery.completion_photo_url} />
              </div>
            )}
          </div>
        )}

        {/* 주문 품목 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-xs text-gray-500 mb-3 font-semibold">📋 주문 품목</div>
          <ul className="space-y-2">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3 text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                <span className="flex-1">{it.name}</span>
                <span className="text-gray-500 text-xs">
                  {it.quantity}kg × {formatKRW(it.unit_price)}
                </span>
                <span className="font-semibold text-[#1a3d6b] w-24 text-right">
                  {formatKRW(it.subtotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-baseline">
            <span className="text-sm text-gray-600">총액 (부가세 별도)</span>
            <span className="text-xl font-bold text-[#1a3d6b]">
              {formatKRW(order.total_amount)}
            </span>
          </div>
        </div>

        {order.memo && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
            <div className="text-xs text-gray-500 mb-1 font-semibold">📝 특이사항</div>
            {order.memo}
          </div>
        )}
      </div>
    </div>
  );
}
