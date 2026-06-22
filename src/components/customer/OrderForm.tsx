'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatKRW, todayISO } from '@/lib/utils';
import { saveDevOrder, generateDevOrderNumber, type DevOrderItem } from '@/lib/dev-orders';
import { isDevMode, DEV_CUSTOMER } from '@/lib/dev-data';
import type { Product } from '@/types';
import { PRODUCT_TYPE_LABEL } from '@/types';

interface LineItem {
  product_id: string;
  quantity: string; // 입력 중 빈 문자열 허용
}

interface Props {
  products: Product[];
  customerName: string;
}

export function OrderForm({ products, customerName }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<LineItem[]>([
    { product_id: products[0]?.id ?? '', quantity: '' },
  ]);
  const [requestedDate, setRequestedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const lineTotals = lines.map((l) => {
    const p = productMap.get(l.product_id);
    const qty = parseFloat(l.quantity) || 0;
    const price = p?.base_price ?? 0;
    return { product: p, qty, price, subtotal: qty * price };
  });

  const total = lineTotals.reduce((s, l) => s + l.subtotal, 0);

  function addLine() {
    setLines([...lines, { product_id: products[0]?.id ?? '', quantity: '' }]);
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 검증
    const validLines = lineTotals.filter((l) => l.product && l.qty > 0);
    if (validLines.length === 0) {
      toast.error('품목과 수량을 입력해주세요');
      return;
    }
    if (!requestedDate) {
      toast.error('납기 요청일을 선택해주세요');
      return;
    }

    setSubmitting(true);

    try {
      if (isDevMode) {
        // ─── 개발 모드: localStorage 저장 ─────────────────────────────
        const items: DevOrderItem[] = validLines.map((l) => ({
          product_id: l.product!.id,
          product_name: l.product!.name,
          quantity: l.qty,
          unit_price: l.price,
          subtotal: l.subtotal,
        }));

        const orderNumber = generateDevOrderNumber();
        saveDevOrder({
          id: crypto.randomUUID(),
          order_number: orderNumber,
          customer_id: DEV_CUSTOMER.id,
          customer_name: customerName,
          status: 'pending',
          requested_date: requestedDate,
          confirmed_date: null,
          rejection_reason: null,
          total_amount: total,
          paid_amount: 0,
          memo: memo || null,
          items,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // 개발 모드 알림 — 콘솔
        console.log('[NOTIFY MOCK] order_created →', { orderNumber, total, items });
        toast.success(`주문 ${orderNumber} 접수 완료 (개발 모드)`);
        setTimeout(() => router.push('/customer/orders'), 600);
      } else {
        // ─── 운영 모드: API 호출 ───────────────────────────────────────
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: validLines.map((l) => ({
              product_id: l.product!.id,
              quantity: l.qty,
              unit_price: l.price,
            })),
            requested_date: requestedDate,
            memo,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        toast.success(`주문 ${data.order_number} 접수 완료`);
        setTimeout(() => router.push('/customer/orders'), 600);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '주문 제출 실패');
      setSubmitting(false);
    }
  }

  return (
    <>
      <Toaster position="top-center" />

      <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">품목 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line, idx) => {
              const p = productMap.get(line.product_id);
              const subtotal = lineTotals[idx].subtotal;
              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50"
                >
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-gray-600">품목</Label>
                    <select
                      value={line.product_id}
                      onChange={(e) => updateLine(idx, { product_id: e.target.value })}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{PRODUCT_TYPE_LABEL[p.type]}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-32">
                    <Label className="text-xs text-gray-600">수량 ({p?.unit ?? 'kg'})</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>

                  <div className="w-32 text-right">
                    <div className="text-xs text-gray-500">금액</div>
                    <div className="text-sm font-semibold text-[#1a3d6b] mt-2">
                      {formatKRW(subtotal)}
                    </div>
                  </div>

                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="p-2 text-gray-400 hover:text-red-500"
                      aria-label="라인 삭제"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              onClick={addLine}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-1" /> 품목 추가
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">납기 요청일</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                min={todayISO()}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                ※ 관리자가 납기일을 조정할 수 있습니다
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">특이사항 (선택)</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                placeholder="포장·납품 시간 등 요청 사항"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* 미리보기 + 제출 */}
        <Card className="bg-[#f0f4fa] border-[#1a3d6b]/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-gray-600">주문 총액</div>
                <div className="text-3xl font-bold text-[#1a3d6b]">
                  {formatKRW(total)}
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting || total === 0}
                className="bg-[#1a3d6b] hover:bg-[#235490] text-white h-12 px-8 text-base"
              >
                {submitting ? '제출 중...' : '주문 제출'}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              주문 제출 시 (주)홍지 관리자에게 카카오 알림톡과 이메일이 자동 발송됩니다.
              {isDevMode && ' (개발 모드: 콘솔에 출력)'}
            </p>
          </CardContent>
        </Card>
      </form>
    </>
  );
}
