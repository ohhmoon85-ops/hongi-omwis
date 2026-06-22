'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDevOrders, saveDevOrder, generateDevOrderNumber, type DevOrder } from '@/lib/dev-orders';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW, formatDate } from '@/lib/utils';
import { ORDER_STATUS_BADGE, type OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Copy } from 'lucide-react';

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

  function refresh() {
    if (isDevMode) {
      setOrders(loadDevOrders());
      setLoaded(true);
    } else {
      // TODO: fetch /api/orders
      setLoaded(true);
    }
  }

  useEffect(refresh, []);

  function reorder(o: DevOrder) {
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
    refresh();
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-700">{o.order_number}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        주문일: {formatDate(o.created_at)} · 납기 요청: {formatDate(o.requested_date)}
                      </div>
                      <ul className="mt-2 text-sm text-gray-700 space-y-0.5">
                        {o.items.map((it, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="flex-1">{it.product_name}</span>
                            <span className="text-gray-500">{it.quantity}kg × {formatKRW(it.unit_price)}</span>
                            <span className="font-semibold text-[#1a3d6b] w-24 text-right">
                              {formatKRW(it.subtotal)}
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
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-gray-500">총액</div>
                      <div className="text-xl font-bold text-[#1a3d6b]">
                        {formatKRW(o.total_amount)}
                      </div>
                      <button
                        onClick={() => reorder(o)}
                        className="mt-2 text-xs text-[#1a3d6b] hover:underline inline-flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> 재주문
                      </button>
                    </div>
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
