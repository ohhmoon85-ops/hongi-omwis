'use client';

import { useEffect, useState } from 'react';
import { loadDevOrders, updateDevOrderStatus, type DevOrder } from '@/lib/dev-orders';
import { fetchOrders, updateOrderStatus, dispatchOrderManually, fetchDispatchedOrderIds } from '@/lib/orders';
import { fetchInvoiceMap, issueInvoice, type InvoiceInfo } from '@/lib/invoices';
import { createClient } from '@/lib/supabase/client';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW, formatDate, todayISO } from '@/lib/utils';
import { ORDER_STATUS_BADGE, type OrderStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import toast, { Toaster } from 'react-hot-toast';
import { Check, X, Calendar, RefreshCw, Truck, FileText, PackageMinus, PackageCheck } from 'lucide-react';

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
  const [invoices, setInvoices] = useState<Map<string, InvoiceInfo>>(new Map());
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<OrderStatus | 'all'>('pending');
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refresh() {
    try {
      if (isDevMode) {
        setOrders(loadDevOrders());
      } else {
        const [ords, invMap, dispIds] = await Promise.all([
          fetchOrders(), fetchInvoiceMap(), fetchDispatchedOrderIds(),
        ]);
        setOrders(ords);
        setInvoices(invMap);
        setDispatchedIds(dispIds);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '주문 조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { refresh(); }, []);

  // 실시간: 거래처 주문 접수/상태변경을 즉시 반영 (운영 모드)
  useEffect(() => {
    if (isDevMode) return;
    const supabase = createClient();
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          toast('🔔 새 주문이 접수되었습니다', { icon: '🔔' });
          refresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => { refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function issue(o: DevOrder) {
    try {
      await issueInvoice(o.id);
      toast.success(`${o.order_number} 세금계산서 발행 완료`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '세금계산서 발행 실패');
    }
  }

  async function approve(o: DevOrder, confirmedDate: string) {
    try {
      if (isDevMode) updateDevOrderStatus(o.id, 'approved', { confirmed_date: confirmedDate });
      else await updateOrderStatus(o.id, 'approved', { confirmed_date: confirmedDate });
      toast.success(`${o.order_number} 승인 완료 — 거래처에 알림 발송됨`);
      setExpandedId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승인 실패');
    }
  }

  async function reject(o: DevOrder, reason: string) {
    try {
      if (isDevMode) updateDevOrderStatus(o.id, 'rejected', { rejection_reason: reason });
      else await updateOrderStatus(o.id, 'rejected', { rejection_reason: reason });
      toast(`${o.order_number} 거절 처리 — 거래처에 사유 발송됨`, { icon: '⚠️' });
      setExpandedId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '거절 실패');
    }
  }

  async function advance(o: DevOrder, next: OrderStatus) {
    try {
      if (isDevMode) updateDevOrderStatus(o.id, next);
      else await updateOrderStatus(o.id, next);
      toast.success(`${o.order_number} → ${ORDER_STATUS_BADGE[next].label}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '상태 변경 실패');
    }
  }

  // 수동 출고 처리 — 상태 변경 없이 재고만 차감 (예: 세금계산서 발행 전에 출고)
  async function manualDispatch(o: DevOrder) {
    if (isDevMode) {
      toast.error('개발 모드에서는 수동 출고 미지원 (Supabase 연결 필요)');
      return;
    }
    const total = o.items.reduce((s, it) => s + it.quantity, 0);
    if (!confirm(
      `${o.order_number} 출고 처리 (총 ${total}kg)\n\n` +
      'FIFO 로 재고에서 자동 차감됩니다. 주문 상태는 변하지 않습니다.\n' +
      '재고 부족 시 전체 롤백됩니다. 계속하시겠습니까?',
    )) return;

    try {
      await dispatchOrderManually(o.id);
      toast.success(`${o.order_number} 출고 처리 완료 — 재고 차감됨`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '출고 실패');
    }
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
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
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
              invoice={invoices.get(o.id)}
              dispatched={dispatchedIds.has(o.id)}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              onApprove={(d) => approve(o, d)}
              onReject={(r) => reject(o, r)}
              onAdvance={(s) => advance(o, s)}
              onIssue={() => issue(o)}
              onManualDispatch={() => manualDispatch(o)}
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
  order: o, invoice, dispatched, expanded,
  onToggle, onApprove, onReject, onAdvance, onIssue, onManualDispatch,
}: {
  order: DevOrder;
  invoice?: InvoiceInfo;
  dispatched: boolean;
  expanded: boolean;
  onToggle: () => void;
  onApprove: (date: string) => void;
  onReject: (reason: string) => void;
  onAdvance: (s: OrderStatus) => void;
  onIssue: () => void;
  onManualDispatch: () => void;
}) {
  const badge = ORDER_STATUS_BADGE[o.status];
  const [confirmedDate, setConfirmedDate] = useState(o.requested_date || todayISO());
  const [reason, setReason] = useState('');

  const hasInvoice = !!invoice && (invoice.status === 'issued' || invoice.status === 'sent');
  // 발행 버튼 노출 단계: 승인~출고준비 사이 (배송 시작 전)
  const canIssue = !isDevMode && !invoice && ['approved', 'processing', 'ready'].includes(o.status);
  // 수동 출고: 운영 모드 + 미출고 + 승인 이후 ~ 배송 전 단계
  const canManualDispatch =
    !isDevMode && !dispatched &&
    ['approved', 'processing', 'ready'].includes(o.status);

  // 다음 상태 후보
  const advances: Array<{ to: OrderStatus; label: string }> = (() => {
    if (o.status === 'approved')   return [{ to: 'processing', label: '처리 시작' }];
    if (o.status === 'processing') return [{ to: 'ready',      label: '출고 준비 완료' }];
    if (o.status === 'ready')      return [{ to: 'shipping',   label: '배송 시작 (배차 생성)' }];
    // 'shipping' → 'delivered' 는 배송기사가 배송 화면에서 처리 (자동 동기화)
    return [];
  })();
  // 배송 시작은 세금계산서 발행 후에만 (운영 모드)
  const shippingBlocked = (s: OrderStatus) => s === 'shipping' && !isDevMode && !hasInvoice;

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
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
            <div className="text-xs text-gray-500">공급가액</div>
            <div className="text-xl font-bold text-[#c8962e]">
              {formatKRW(o.total_amount)}
            </div>
            {hasInvoice ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                <FileText className="w-3 h-3" /> 세금계산서 발행{invoice?.is_mock ? ' (데모)' : ''}
              </span>
            ) : canIssue ? (
              <button
                onClick={(e) => { e.stopPropagation(); onIssue(); }}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#c8962e] hover:bg-[#b3851f] text-white transition"
              >
                <FileText className="w-3 h-3" /> 세금계산서 발행
              </button>
            ) : !isDevMode && o.status !== 'pending' && o.status !== 'rejected' ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                <FileText className="w-3 h-3" /> 미발행
              </span>
            ) : null}
            {dispatched && (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <PackageCheck className="w-3 h-3" /> 출고 완료 (재고 차감됨)
              </span>
            )}
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

            {/* 세금계산서 발행 / 상태 */}
            {(canIssue || hasInvoice) && (
              <div className="pt-2 border-t border-[#1f2433]">
                {hasInvoice ? (
                  <div className="text-xs text-gray-300 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-green-300">세금계산서 발행 완료</span>
                    <span>공급가액 {formatKRW(invoice!.supply_amount)}</span>
                    <span>세액 {formatKRW(invoice!.tax_amount)}</span>
                    <span className="font-semibold">합계 {formatKRW(invoice!.total_amount)}</span>
                    {invoice!.nts_confirm_number && (
                      <span className="text-gray-500">승인번호 {invoice!.nts_confirm_number}</span>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={onIssue}
                    className="bg-[#c8962e] hover:bg-[#b3851f] text-white"
                  >
                    <FileText className="w-4 h-4 mr-1" />세금계산서 발행 (부가세 10% 별도)
                  </Button>
                )}
              </div>
            )}

            {advances.length > 0 && (
              <div className="pt-2 border-t border-[#1f2433] flex flex-col gap-2">
                <div className="flex gap-2 flex-wrap">
                  {advances.map((a) => (
                    <Button
                      key={a.to}
                      onClick={() => onAdvance(a.to)}
                      disabled={shippingBlocked(a.to)}
                      className="bg-[#1a3d6b] hover:bg-[#235490] text-white disabled:opacity-40"
                    >
                      <Truck className="w-4 h-4 mr-1" />{a.label}
                    </Button>
                  ))}
                  {canManualDispatch && (
                    <Button
                      onClick={onManualDispatch}
                      variant="outline"
                      className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                      title="상태 변경 없이 FIFO 로 재고만 미리 차감"
                    >
                      <PackageMinus className="w-4 h-4 mr-1" />수동 출고 (재고만 차감)
                    </Button>
                  )}
                </div>
                {o.status === 'ready' && !hasInvoice && !isDevMode && (
                  <p className="text-[11px] text-amber-400">
                    ⚠️ 세금계산서를 먼저 발행해야 배송을 시작할 수 있습니다.
                  </p>
                )}
                {canManualDispatch && (
                  <p className="text-[11px] text-gray-500">
                    💡 「수동 출고」는 상태 변경 없이 FIFO 재고만 차감합니다. 외상·즉시 출고 등에 사용.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
