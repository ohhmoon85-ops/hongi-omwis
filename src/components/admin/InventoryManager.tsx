'use client';

import { useEffect, useState } from 'react';
import {
  fetchProducts, fetchInventory, fetchSafetyMap, fetchInventoryLogs,
  fetchOutboundRateMap, buildStockSummary, addInbound, adjustLot, setSafetyStock,
  type InventoryLot, type StockSummary, type InventoryLog,
} from '@/lib/inventory';
import { syncInventoryToACIS } from '@/lib/acis';
import { isDevMode } from '@/lib/env';
import { formatNumber, formatDate, todayISO } from '@/lib/utils';
import type { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, PackagePlus, AlertTriangle, Pencil } from 'lucide-react';

export function InventoryManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [summary, setSummary] = useState<StockSummary[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    if (isDevMode) { setLoaded(true); return; }
    try {
      const [prods, inv, safety, lg, outRate] = await Promise.all([
        fetchProducts(), fetchInventory(), fetchSafetyMap(), fetchInventoryLogs(),
        fetchOutboundRateMap(30),
      ]);
      setProducts(prods);
      setLots(inv);
      const built = buildStockSummary(prods, inv, safety, outRate);
      setSummary(built);
      setLogs(lg);

      // ACIS 자동 sync — 가장 부족한 품목의 Weeks on Hand 기준
      // (출고 데이터가 있는 품목 중 최소값)
      const meaningful = built.filter((s) => s.weeksOnHand != null);
      if (meaningful.length > 0) {
        const min = meaningful.reduce((a, b) =>
          (a.weeksOnHand! < b.weeksOnHand!) ? a : b,
        );
        await syncInventoryToACIS({
          weeks_on_hand: min.weeksOnHand!,
          threshold: 6,
          should_hold: min.shouldHold,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재고 조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { refresh(); }, []);

  if (isDevMode) {
    return (
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
        <CardContent className="py-12 text-center text-sm text-amber-400">
          🛠️ 개발 모드 — 재고 데이터는 Supabase 연결 시 표시됩니다.
        </CardContent>
      </Card>
    );
  }

  const lowCount = summary.filter((s) => s.isLow).length;

  return (
    <>
      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          {lowCount > 0 ? (
            <span className="text-red-400 inline-flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> 안전재고 미달 {lowCount}건
            </span>
          ) : (
            <span className="text-green-400">안전재고 정상</span>
          )}
        </div>
        <button onClick={refresh} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          {/* 품목별 재고 요약 */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.map((s) => (
              <StockCard key={s.product_id} summary={s} onSaved={refresh} />
            ))}
          </section>

          {/* 입고 등록 */}
          <InboundForm products={products} onDone={refresh} />

          {/* lot 목록 */}
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">재고 Lot 목록</h2>
            {lots.length === 0 ? (
              <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
                <CardContent className="py-8 text-center text-sm text-gray-500">
                  등록된 재고 lot 이 없습니다. 위에서 입고를 등록하세요.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {lots.map((lot) => (
                  <LotRow key={lot.id} lot={lot} onSaved={refresh} />
                ))}
              </div>
            )}
          </section>

          {/* 최근 입출고 이력 */}
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">최근 입출고 이력</h2>
            <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
              <CardContent className="py-3">
                {logs.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center">이력이 없습니다.</div>
                ) : (
                  <ul className="divide-y divide-[#1f2433]">
                    {logs.map((l) => (
                      <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <LogBadge type={l.log_type} />
                          <span className="text-gray-200">{l.product_name}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className={l.quantity >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {l.quantity >= 0 ? '+' : ''}{formatNumber(l.quantity)}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(l.created_at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}

function StockCard({ summary: s, onSaved }: { summary: StockSummary; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState(s.minQuantity != null ? String(s.minQuantity) : '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await setSafetyStock(s.product_id, parseFloat(min) || 0);
      toast.success('안전재고 설정 저장');
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  // 소진 예측 시각화
  // 임계치: 2주 미만 위험(적색), 2-6주 주의(황색), 6주 이상 안전(녹색)
  const woh = s.weeksOnHand;
  const wohBand =
    woh == null ? null
    : woh < 2  ? { color: 'text-red-400',    label: '⚠ 위험', desc: '곧 소진' }
    : woh < 6  ? { color: 'text-yellow-400', label: '주의',   desc: '발주 검토' }
    :            { color: 'text-green-400',  label: '안전',   desc: '재고 충분 (ACIS HOLD)' };

  return (
    <Card className={`bg-[#171b26] ${s.isLow ? 'border-red-500/40' : 'border-[#1f2433]'} text-white`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-300 flex items-center justify-between">
          <span>{s.product_name}</span>
          {s.isLow && <AlertTriangle className="w-4 h-4 text-red-400" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${s.isLow ? 'text-red-400' : 'text-blue-300'}`}>
          {formatNumber(s.total)}<span className="text-base text-gray-500 ml-1">{s.unit}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">활성 lot {s.lotCount}개</div>

        {/* 소진 예측 (Weeks on Hand) */}
        {wohBand ? (
          <div className="mt-3 pt-3 border-t border-[#1f2433] space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-gray-400">소진 예측</span>
              <span className={`text-xs font-semibold ${wohBand.color}`}>{wohBand.label}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-lg font-bold ${wohBand.color}`}>
                약 {formatNumber(woh!, 1)}주
              </span>
              <span className="text-[10px] text-gray-500">
                {s.depletesAt && formatDate(s.depletesAt)} 소진 예상
              </span>
            </div>
            <div className="text-[10px] text-gray-500">
              일평균 출고 {formatNumber(s.dailyAvgOut, 1)}{s.unit} · {wohBand.desc}
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-[#1f2433]">
            <div className="text-[10px] text-gray-500">
              소진 예측: 최근 30일 출고 데이터 부족
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#1f2433]">
          {editing ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-gray-400">안전재고 ({s.unit})</label>
                <Input
                  type="number" inputMode="decimal" value={min}
                  onChange={(e) => setMin(e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white h-8 mt-1"
                />
              </div>
              <Button onClick={save} disabled={saving} className="h-8 bg-[#1a3d6b] hover:bg-[#235490] text-white text-xs">
                저장
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              안전재고 {s.minQuantity != null ? `${formatNumber(s.minQuantity)}${s.unit}` : '미설정'}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InboundForm({ products, onDone }: { products: Product[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [quantity, setQuantity] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [location, setLocation] = useState('');
  const [importDate, setImportDate] = useState(todayISO());
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const qty = parseFloat(quantity);
    if (!productId || !qty || qty <= 0) {
      toast.error('품목과 수량을 입력하세요');
      return;
    }
    setSaving(true);
    try {
      await addInbound({
        product_id: productId,
        quantity: qty,
        lot_number: lotNumber || undefined,
        location: location || undefined,
        import_date: importDate || undefined,
        expiry_date: expiryDate || undefined,
      });
      toast.success('입고 등록 완료');
      setQuantity(''); setLotNumber(''); setLocation(''); setExpiryDate('');
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '입고 실패');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
        <PackagePlus className="w-4 h-4 mr-1" /> 입고 등록
      </Button>
    );
  }

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-gray-200">입고 등록 (신규 Lot)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">품목</label>
            <select
              value={productId} onChange={(e) => setProductId(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm"
            >
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">수량</label>
            <Input type="number" inputMode="decimal" value={quantity}
              onChange={(e) => setQuantity(e.target.value)} placeholder="0"
              className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-400">Lot 번호</label>
            <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
              placeholder="예: 2026-IMP-001" className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-400">보관 위치</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="예: A-01" className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-400">입고일</label>
            <Input type="date" value={importDate} onChange={(e) => setImportDate(e.target.value)}
              className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-400">만료일 (선택)</label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
              className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
            {saving ? '저장 중...' : '입고 저장'}
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline">취소</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LotRow({ lot, onSaved }: { lot: InventoryLot; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(lot.quantity));
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = parseFloat(qty);
    if (isNaN(n) || n < 0) { toast.error('수량을 확인하세요'); return; }
    setSaving(true);
    try {
      await adjustLot(lot, n, memo);
      toast.success('재고 조정 완료');
      setEditing(false); setMemo('');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조정 실패');
    } finally {
      setSaving(false);
    }
  }

  const statusColor =
    lot.status === 'active' ? 'text-green-300'
    : lot.status === 'reserved' ? 'text-yellow-300' : 'text-gray-500';

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-semibold">{lot.product_name}</div>
            <div className="text-xs text-gray-400 mt-0.5 space-x-2">
              <span>Lot {lot.lot_number ?? '-'}</span>
              <span>· 위치 {lot.location ?? '-'}</span>
              <span>· 입고 {formatDate(lot.import_date)}</span>
              {lot.expiry_date && <span>· 만료 {formatDate(lot.expiry_date)}</span>}
              <span className={`· ${statusColor}`}>· {lot.status}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-300">
              {formatNumber(lot.quantity)}<span className="text-xs text-gray-500 ml-1">{lot.unit}</span>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 mt-1">
                <Pencil className="w-3 h-3" /> 조정
              </button>
            )}
          </div>
        </div>

        {editing && (
          <div className="mt-3 pt-3 border-t border-[#1f2433] flex flex-wrap items-end gap-2">
            <div className="w-28">
              <label className="text-[11px] text-gray-400">수량</label>
              <Input type="number" inputMode="decimal" value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-[11px] text-gray-400">사유 (선택)</label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)}
                placeholder="실사 보정, 파손 등"
                className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
            </div>
            <Button onClick={save} disabled={saving} className="h-9 bg-[#1a3d6b] hover:bg-[#235490] text-white">
              저장
            </Button>
            <Button onClick={() => { setEditing(false); setQty(String(lot.quantity)); }} variant="outline" className="h-9">
              취소
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogBadge({ type }: { type: 'in' | 'out' | 'adjust' }) {
  const map = {
    in:     { label: '입고', color: 'bg-green-500/20 text-green-300' },
    out:    { label: '출고', color: 'bg-orange-500/20 text-orange-300' },
    adjust: { label: '조정', color: 'bg-blue-500/20 text-blue-300' },
  };
  const b = map[type];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${b.color}`}>{b.label}</span>;
}
