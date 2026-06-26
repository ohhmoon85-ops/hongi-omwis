'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Copy, Truck } from 'lucide-react';
import { loadDevOrders, saveDevOrder, generateDevOrderNumber, type DevOrder } from '@/lib/dev-orders';
import { fetchOrders, reorder as reorderApi } from '@/lib/orders';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW, formatDate } from '@/lib/utils';
import { ORDER_STATUS_BADGE, type OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';

const STATUS_FILTERS: Array<{ key: OrderStatus | 'all'; label: string }> = [
  { key: 'all',        label: '전체' },
  { key: 'pending',    label: '대기' },
  { key: 'approved',   label: '승인' },
  { key: 'processing', label: '처리중' },
  { key: 'shipping',   label: '배송중' },
  { key: 'delivered',  label: '완료' },
  { key: 'rejected',   label: '거절' },
];

export function CustomerOrderList() {
  const [orders, setOrders] = useState<DevOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      setOrders(isDevMode ? loadDevOrders() : await fetchOrders());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '주문 조회 실패');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function reorder(o: DevOrder) {
    try {
      if (isDevMode) {
        const orderNumber = generateDevOrderNumber();
        saveDevOrder({
          ...o,
          id: crypto.randomUUID(),
          order_number: orderNumber,
          status: 'pending',
          confirmed_date: null,
          rejection_reason: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        toast.success(`주문 ${orderNumber} 으로 재주문되었습니다`);
      } else {
        const orderNumber = await reorderApi(o);
        toast.success(`주문 ${orderNumber} 으로 재주문되었습니다`);
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재주문 실패');
    }
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-4 max-w-5xl">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === f.key
                  ? 'bg-[#1a3d6b] text-white border-[#1a3d6b]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1a3d6b]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="p-2 text-gray-400 hover:text-[#1a3d6b]"
          aria-label="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <Card className="max-w-5xl">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            주문 내역이 없습니다.
            <div className="mt-3">
              <Link href="/customer/order">
                <Button className="bg-[#1a3d6b] hover:bg-[#235490] text-white">첫 주문하기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-w-5xl">
          {filtered.map((o) => {
            const badge = ORDER_STATUS_BADGE[o.status];
            return (
              <Card key={o.id} className="hover:shadow-md transition">
                <CardContent className="py-4">
                  {/* 상단: 주문번호+배지 / 총액 */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-gray-700">{o.order_number}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        주문일 {formatDate(o.created_at)} · 납기 {formatDate(o.requested_date)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-gray-500">총액</div>
                      <div className="text-lg sm:text-xl font-bold text-[#1a3d6b] leading-tight">
                        {formatKRW(o.total_amount)}
                      </div>
                    </div>
                  </div>

                  {/* 품목 목록 — 모바일은 2행 분리, 데스크톱은 1행 */}
                  <ul className="text-sm text-gray-700 space-y-1.5 sm:space-y-0.5 border-t border-gray-100 pt-2">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex flex-col sm:flex-row sm:justify-between sm:gap-3">
                        <span className="flex-1 truncate">{it.product_name}</span>
                        <span className="flex justify-between sm:justify-end sm:gap-3 text-xs sm:text-sm">
                          <span className="text-gray-500">{it.quantity}kg × {formatKRW(it.unit_price)}</span>
                          <span className="font-semibold text-[#1a3d6b] sm:w-24 sm:text-right">
                            {formatKRW(it.subtotal)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {o.rejection_reason && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      거절 사유: {o.rejection_reason}
                    </div>
                  )}
                  {o.memo && (
                    <div className="mt-2 text-xs text-gray-600">
                      📝 {o.memo}
                    </div>
                  )}

                  {/* 액션 버튼들 — 배송 추적 + 재주문 */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap justify-end gap-2">
                    {/* 배송 단계인 주문은 배송 추적 노출 */}
                    {['approved', 'processing', 'ready', 'shipping', 'delivered'].includes(o.status) && (
                      <Link
                        href={`/customer/delivery/${o.id}`}
                        className="inline-flex items-center gap-1.5 px-3 h-10 text-sm text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-500 hover:text-white hover:border-orange-500 transition"
                      >
                        <Truck className="w-4 h-4" /> 배송 추적
                      </Link>
                    )}
                    <button
                      onClick={() => reorder(o)}
                      className="inline-flex items-center gap-1.5 px-3 h-10 text-sm text-[#1a3d6b] border border-[#1a3d6b]/20 rounded-lg hover:bg-[#1a3d6b] hover:text-white transition"
                    >
                      <Copy className="w-4 h-4" /> 재주문
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isDevMode && (
        <p className="mt-6 text-xs text-amber-600 max-w-5xl">
          🛠️ 개발 모드 — 주문은 브라우저 localStorage 에 저장됩니다 (Supabase 미연결).
        </p>
      )}
    </>
  );
}
