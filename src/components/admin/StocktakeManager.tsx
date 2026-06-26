'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchInventory, adjustLot, type InventoryLot,
} from '@/lib/inventory';
import { isDevMode } from '@/lib/env';
import { formatNumber, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import toast, { Toaster } from 'react-hot-toast';
import { ClipboardCheck, RefreshCw, AlertTriangle, Check } from 'lucide-react';

interface LotEntry {
  lot: InventoryLot;
  actual: string;          // 입력 중 — 빈 문자열 허용
  memo: string;
}

export function StocktakeManager() {
  const [entries, setEntries] = useState<LotEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (isDevMode) { setLoaded(true); return; }
    try {
      const lots = await fetchInventory();
      const active = lots.filter((l) => l.status !== 'depleted');
      setEntries(active.map((lot) => ({ lot, actual: '', memo: '' })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재고 조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, []);

  function updateEntry(idx: number, patch: Partial<LotEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  // 차이 = 실사값 - 장부값 (양수: 잉여, 음수: 부족)
  const diffs = useMemo(
    () => entries.map((e) => {
      const a = parseFloat(e.actual);
      if (isNaN(a)) return null;
      return a - e.lot.quantity;
    }),
    [entries],
  );

  const filledCount = diffs.filter((d) => d !== null).length;
  const discrepancyCount = diffs.filter((d) => d !== null && d !== 0).length;
  const totalDiff = diffs.reduce<number>(
    (s, d) => s + (d ?? 0), 0,
  );

  async function commitAll() {
    if (filledCount === 0) {
      toast.error('실사값을 입력한 lot 이 없습니다');
      return;
    }
    if (!confirm(
      `실사 결과를 일괄 적용합니다.\n\n` +
      `입력: ${filledCount}건 / 차이 발생: ${discrepancyCount}건\n` +
      `차이 합계: ${formatNumber(totalDiff, 1)}kg\n\n` +
      `각 lot 의 장부재고가 실사값으로 갱신되고, inventory_logs(adjust) 가 기록됩니다.`,
    )) return;

    setSaving(true);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const diff = diffs[i];
      if (diff === null) continue;
      if (diff === 0) { success++; continue; } // 차이 없는 행도 성공 카운트

      const newQty = parseFloat(e.actual);
      try {
        await adjustLot(
          e.lot,
          newQty,
          e.memo || `재고 실사: 장부 ${e.lot.quantity} → 실사 ${newQty} (${diff > 0 ? '+' : ''}${formatNumber(diff, 1)})`,
        );
        success++;
      } catch (err) {
        console.error(`[stocktake] ${e.lot.lot_number} 실패:`, err);
        failed++;
      }
    }

    toast.success(`실사 적용 완료 — 성공 ${success} / 실패 ${failed}`);
    setSaving(false);
    await load();
  }

  if (isDevMode) {
    return (
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
        <CardContent className="py-12 text-center text-sm text-amber-400">
          🛠️ 개발 모드 — 재고 실사는 Supabase 연결 후 사용 가능합니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Toaster position="top-center" />

      {/* 요약 */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white mb-4">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
              <div>
                <div className="text-xs text-gray-400">전체 Lot</div>
                <div className="text-lg font-bold text-gray-200">{entries.length}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">입력</div>
                <div className="text-lg font-bold text-blue-300">{filledCount}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">차이 발생</div>
                <div className={`text-lg font-bold ${discrepancyCount > 0 ? 'text-yellow-300' : 'text-green-300'}`}>
                  {discrepancyCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">차이 합계</div>
                <div className={`text-lg font-bold ${totalDiff > 0 ? 'text-green-300' : totalDiff < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                  {totalDiff > 0 ? '+' : ''}{formatNumber(totalDiff, 1)}kg
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                className="p-2 text-gray-400 hover:text-white"
                aria-label="새로고침"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <Button
                onClick={commitAll}
                disabled={saving || filledCount === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <ClipboardCheck className="w-4 h-4 mr-1" />
                {saving ? '적용 중...' : `실사 적용 (${filledCount}건)`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* lot 별 입력 표 */}
      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : entries.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            실사할 활성 lot 이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">
              Lot 별 실사 입력
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              실측 수량을 입력하면 차이가 자동 계산됩니다. 차이=0 이면 조정 로그 없이 통과.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-3 font-normal">품목 / Lot</th>
                    <th className="text-right py-2 px-3 font-normal">장부 재고</th>
                    <th className="text-right py-2 px-3 font-normal w-28">실사 입력</th>
                    <th className="text-right py-2 px-3 font-normal w-20">차이</th>
                    <th className="text-left py-2 px-3 font-normal">사유 (선택)</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => {
                    const diff = diffs[idx];
                    const diffClass =
                      diff === null ? 'text-gray-600'
                      : diff === 0   ? 'text-green-400'
                      : diff > 0     ? 'text-blue-300'
                      :                'text-red-400';
                    return (
                      <tr key={e.lot.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                        <td className="py-2 pr-3">
                          <div className="text-gray-200">{e.lot.product_name}</div>
                          <div className="text-[10px] text-gray-500">
                            Lot {e.lot.lot_number ?? '-'} · 위치 {e.lot.location ?? '-'}
                            {e.lot.import_date && ` · 입고 ${formatDate(e.lot.import_date)}`}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-300">
                          {formatNumber(e.lot.quantity)} {e.lot.unit}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            value={e.actual}
                            onChange={(ev) => updateEntry(idx, { actual: ev.target.value })}
                            placeholder="0"
                            className="h-8 w-24 ml-auto bg-[#0f1117] border-[#2a2f3e] text-white text-right"
                          />
                        </td>
                        <td className={`py-2 px-3 text-right text-sm font-semibold ${diffClass}`}>
                          {diff === null ? '—' :
                           diff === 0   ? <Check className="w-4 h-4 inline" /> :
                           `${diff > 0 ? '+' : ''}${formatNumber(diff, 1)}`}
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={e.memo}
                            onChange={(ev) => updateEntry(idx, { memo: ev.target.value })}
                            placeholder={diff != null && diff < 0 ? '파손/도난/누락 등' : '실측 비고'}
                            className="h-8 bg-[#0f1117] border-[#2a2f3e] text-white text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {discrepancyCount > 0 && (
              <div className="mt-3 px-3 py-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs inline-flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  차이가 발생한 lot 이 {discrepancyCount}건 있습니다. 사유를 함께 입력해두면
                  추후 감사·추적이 쉬워집니다.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
