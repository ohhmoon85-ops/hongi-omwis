'use client';

import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { isDevMode } from '@/lib/env';
import { formatKRW, formatDate, todayISO } from '@/lib/utils';
import type { Product, ProductType } from '@/types';
import { PRODUCT_TYPE_LABEL } from '@/types';

interface CustomerPrice {
  id: string;
  customer_id: string;
  product_id: string;
  unit_price: number;
  valid_from: string | null;
  valid_to: string | null;
}

interface EditState {
  productId: string;
  priceId: string | null;   // null = 신규 추가, 존재 = 수정
  unitPrice: string;
  validFrom: string;
  validTo: string;
}

interface Props { customerId: string }

export function CustomerPricesEditor({ customerId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (isDevMode) {
      setLoaded(true);
      return;
    }
    const supabase = createClient();
    const [productsRes, pricesRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('type'),
      supabase.from('customer_prices').select('*').eq('customer_id', customerId),
    ]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    if (pricesRes.data)   setPrices(pricesRes.data as CustomerPrice[]);
    setLoaded(true);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [customerId]);

  function startEdit(product: Product, existing?: CustomerPrice) {
    setEditing({
      productId: product.id,
      priceId: existing?.id ?? null,
      unitPrice: String(existing?.unit_price ?? product.base_price ?? ''),
      validFrom: existing?.valid_from ?? todayISO(),
      validTo: existing?.valid_to ?? '',
    });
  }

  async function save() {
    if (!editing) return;
    const supabase = createClient();
    const payload = {
      customer_id: customerId,
      product_id: editing.productId,
      unit_price: parseInt(editing.unitPrice, 10) || 0,
      valid_from: editing.validFrom || null,
      valid_to:   editing.validTo   || null,
    };
    if (payload.unit_price <= 0) {
      toast.error('단가는 0 보다 커야 합니다');
      return;
    }

    if (editing.priceId) {
      const { error } = await supabase
        .from('customer_prices').update(payload).eq('id', editing.priceId);
      if (error) { toast.error(error.message); return; }
      toast.success('단가 갱신 완료');
    } else {
      const { error } = await supabase.from('customer_prices').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('단가 등록 완료');
    }

    setEditing(null);
    await load();
  }

  async function remove(priceId: string) {
    if (!confirm('이 거래처의 개별 단가를 삭제하시겠습니까? (이후 기본 단가가 적용됩니다)')) return;
    const supabase = createClient();
    const { error } = await supabase.from('customer_prices').delete().eq('id', priceId);
    if (error) { toast.error(error.message); return; }
    toast.success('단가 삭제 완료');
    await load();
  }

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white max-w-5xl">
      <CardHeader>
        <CardTitle className="text-base text-gray-200">
          🏷️ 거래처별 개별 단가
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          이 거래처에만 적용되는 단가. 설정 안 된 품목은 기본 단가가 자동 적용됩니다.
        </p>
      </CardHeader>
      <CardContent>
        {isDevMode ? (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            ⚠️ 개발 모드 — 거래처별 단가는 Supabase 연결 후 사용 가능합니다.
          </div>
        ) : !loaded ? (
          <div className="text-sm text-gray-500">불러오는 중...</div>
        ) : products.length === 0 ? (
          <div className="text-sm text-gray-500">등록된 품목이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-3 font-normal">품목</th>
                  <th className="text-right py-2 px-3 font-normal">기본 단가</th>
                  <th className="text-right py-2 px-3 font-normal">개별 단가</th>
                  <th className="text-right py-2 px-3 font-normal">차이</th>
                  <th className="text-center py-2 px-3 font-normal">유효 기간</th>
                  <th className="text-right py-2 pl-3 font-normal w-32">작업</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const existing = prices.find((pr) => pr.product_id === p.id);
                  const isEditing = editing?.productId === p.id;
                  const diff = existing && p.base_price
                    ? existing.unit_price - p.base_price
                    : 0;
                  return (
                    <tr key={p.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                      <td className="py-2 pr-3">
                        <div className="text-gray-200">{p.name}</div>
                        <div className="text-[10px] text-gray-500">[{PRODUCT_TYPE_LABEL[p.type as ProductType]}]</div>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-400">
                        {formatKRW(p.base_price)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={editing!.unitPrice}
                            onChange={(e) => setEditing({ ...editing!, unitPrice: e.target.value })}
                            className="h-8 w-28 ml-auto bg-[#0f1117] border-[#2a2f3e] text-white text-right"
                            placeholder="0"
                          />
                        ) : existing ? (
                          <span className="text-[#c8962e] font-semibold">
                            {formatKRW(existing.unit_price)}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">— (기본가 적용)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {existing && diff !== 0 ? (
                          <span className={diff > 0 ? 'text-red-400' : 'text-green-400'}>
                            {diff > 0 ? '+' : ''}{formatKRW(diff)}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-xs text-gray-500">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="date"
                              value={editing!.validFrom}
                              onChange={(e) => setEditing({ ...editing!, validFrom: e.target.value })}
                              className="h-8 w-32 bg-[#0f1117] border-[#2a2f3e] text-white"
                            />
                            <span>~</span>
                            <Input
                              type="date"
                              value={editing!.validTo}
                              onChange={(e) => setEditing({ ...editing!, validTo: e.target.value })}
                              className="h-8 w-32 bg-[#0f1117] border-[#2a2f3e] text-white"
                            />
                          </div>
                        ) : existing ? (
                          <>
                            {formatDate(existing.valid_from)}
                            {existing.valid_to ? ` ~ ${formatDate(existing.valid_to)}` : ' ~'}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={save}
                              className="p-1.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30"
                              aria-label="저장"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="p-1.5 rounded bg-gray-600/20 text-gray-400 hover:bg-gray-600/30"
                              aria-label="취소"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : existing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => startEdit(p, existing)}
                              className="p-1.5 rounded bg-[#1a3d6b]/20 text-blue-300 hover:bg-[#1a3d6b]/30"
                              aria-label="수정"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remove(existing.id)}
                              className="p-1.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25"
                              aria-label="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(p)}
                            className="h-7 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />설정
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
