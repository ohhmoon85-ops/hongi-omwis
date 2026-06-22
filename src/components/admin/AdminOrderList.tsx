'use client';

import { useEffect, useState } from 'react';
import { loadDevOrders, updateDevOrderStatus, type DevOrder } from '@/lib/dev-orders';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW, formatDate, todayISO } from '@/lib/utils';
import { ORDER_STATUS_BADGE, type OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import toast, { Toaster } from 'react-hot-toast';
import { Check, X, Calendar, RefreshCw, Truck } from 'lucide-react';

const STATUS_FILTERS: Array<{ key: OrderStatus | 'all'; label: string }> = [
  { key: 'all',        label: '전체' },
  { key: 'pending',    label: '대기' },
  { key: 'approved',   label: '승인' },
  { key: 'processing', label: '처리중' },
  { key: 'ready',      label: '출고준비' },
  { key: 'shipping',   label: '배송중' },
  { key: 'delivered',  label: '완료' },
  { key: 'rejected',   label: '거절' },
];

export function AdminOrderList() {
  const [orders, setOrders] = useState<DevOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('pending');
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function refresh() {
    if (isDevMode) setOrders(loadDevOrders());
    setLoaded(true);
  }
  useEffect(refresh, []);

  function approve(o: DevOrder, confirmedDate: string) {
    updateDevOrderStatus(o.id, 'approved', { confirmed_date: confirmedDate });
    console.log('[NOTIFY MOCK] order_approved →', o.order_number);
    toast.success(`${o.order_number} 승인 완료 — 거래처에 알림 발송됨`);
    refresh();
    setExpandedId(null);
  }

  function reject(o: DevOrder, reason: string) {
    updateDevOrderStatus(o.id, 'rejected', { rejection_reason: reason });
    console.log('[NOTIFY MOCK] order_rejected →', o.order_number, reason);
    toast(`${o.order_number} 거절 처리 — 거래처에 사유 발송됨`, { icon: '⚠️' });
    refresh();
    setExpandedId(null);
  }

  function advance(o: DevOrder, next: OrderStatus) {
    updateDevOrderStatus(o.id, next);
    toast.success(`${o.order_number} → ${ORDER_STATUS_BADGE[next].label}`);
    refresh();
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <>
      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === f.key
                  ? 'bg-[#1a3d6b] text-white border-[#1a3d6b]'
                  : 'bg-[#171b26] text-gray-300 border-[#2a2f3e] hover:border-[#1a3d6b]'
              }`}
            >
              {f.label}
              {f.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="p-2 text-gray-400 hover:text-white"
          aria-label="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#171b26] border-[#1f2433]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            해당 상태의 주문이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              onApprove={(d) => approve(o, d)}
              onReject={(r) => reject(o, r)}
              onAdvance={(s) => advance(o, s)}
            />
          ))}
        </div>
      )}

      {isDevMode && (
        <p className="mt-6 text-xs text-amber-400">
          🛠️ 개발 모드 — 주문은 브라우저 localStorage 에 저장됩니다.
          거래처 화면(/customer/order)에서 주문 제출 후 여기로 돌아와 새로고침하세요.
        </p>
      )}
    </>
  );
}

function OrderRow({
  order: o, expanded, onToggle, onApprove, onReject, onAdvance,
}: {
  order: DevOrder;
  expanded: boolean;
  onToggle: () => void;
  onApprove: (date: string) => void;
  onReject: (reason: string) => void;
  onAdvance: (s: OrderStatus) => void;
}) {
  const badge = ORDER_STATUS_BADGE[o.status];
  const [confirmedDate, setConfirmedDate] = useState(o.requested_date || todayISO());
  const [reason, setReason] = useState('');

  // 다음 상태 후보
  const advances: Array<{ to: OrderStatus; label: string }> = (() => {
    if (o.status === 'approved')   return [{ to: 'processing', label: '처리 시작' }];
    if (o.status === 'processing') return [{ to: 'ready',      label: '출고 준비 완료' }];
    if (o.status === 'ready')      return [{ to: 'shipping',   label: '배송 시작' }];
    if (o.status === 'shipping')   return [{ to: 'delivered',  label: '배송 완료' }];
    return [];
  })();

  return (
    <Card className="bg-[#171b26] border-[#1f2433] text-white">
      <CardContent className="py-4">
        <div
          className="flex flex-wrap items-start justify-between gap-3 cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{o.order_number}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <div className="text-sm font-semibold mt-1">{o.customer_name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              주문일: {formatDate(o.created_at)} · 납기 요청: {formatDate(o.requested_date)}
              {o.confirmed_date && ` · 확정 납기: ${formatDate(o.confirmed_date)}`}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {o.items.length}개 품목 · {o.items.reduce((s, it) => s + it.quantity, 0)}kg
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-500">총액</div>
            <div className="text-xl font-bold text-[#c8962e]">
              {formatKRW(o.total_amount)}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-[#1f2433] space-y-4" onClick={(e) => e.stopPropagation()}>
            {/* 품목 상세 */}
            <div className="space-y-1">
              {o.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="flex-1 text-gray-200">{it.product_name}</span>
                  <span className="text-gray-400 w-32 text-right">
                    {it.quantity}kg × {formatKRW(it.unit_price)}
                  </span>
                  <span className="font-semibold w-28 text-right text-[#c8962e]">
                    {formatKRW(it.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {o.memo && (
              <div className="text-sm text-gray-300 bg-[#0f1117] px-3 py-2 rounded">
                📝 {o.memo}
              </div>
            )}

            {o.rejection_reason && (
              <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded border border-red-500/30">
                거절 사유: {o.rejection_reason}
              </div>
            )}

            {/* 액션 */}
            {o.status === 'pending' && (
              <div className="space-y-3 pt-2 border-t border-[#1f2433]">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      <Calendar className="w-3 h-3 inline mr-1" />확정 납기일
                    </label>
                    <Input
                      type="date"
                      value={confirmedDate}
                      onChange={(e) => setConfirmedDate(e.target.value)}
                      className="bg-[#0f1117] border-[#2a2f3e] text-white"
                    />
                  </div>
                  <Button
                    onClick={() => onApprove(confirmedDate)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-1" />승인
                  </Button>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-gray-400 block mb-1">거절 사유 (필수)</label>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="재고 부족, 납기 불가 등"
                      className="bg-[#0f1117] border-[#2a2f3e] text-white"
                    />
                  </div>
                  <Button
                    onClick={() => reason.trim() && onReject(reason.trim())}
                    disabled={!reason.trim()}
                    variant="destructive"
                  >
                    <X className="w-4 h-4 mr-1" />거절
                  </Button>
                </div>
              </div>
            )}

            {advances.length > 0 && (
              <div className="pt-2 border-t border-[#1f2433] flex gap-2">
                {advances.map((a) => (
                  <Button
                    key={a.to}
                    onClick={() => onAdvance(a.to)}
                    className="bg-[#1a3d6b] hover:bg-[#235490] text-white"
                  >
                    <Truck className="w-4 h-4 mr-1" />{a.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
