'use client';

// ============================================================================
// QualityStats — 공급사별/SKU별 불량률 + 월별 추이 + 불량 사유 Top 5
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { loadDevInspections } from '@/lib/dev-inspections';
import { fetchInspections } from '@/lib/inspections';
import { isDevMode } from '@/lib/dev-data';
import type { Inspection } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

interface RateRow { key: string; total: number; fail: number; rate: number }

export function QualityStats() {
  const [items, setItems] = useState<Inspection[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      setItems(isDevMode ? loadDevInspections() : await fetchInspections());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '검수 조회 실패');
    } finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); }, []);

  // 공급사별 불량률
  const bySupplier = useMemo<RateRow[]>(() => {
    const m = new Map<string, { total: number; fail: number }>();
    for (const i of items) {
      const k = i.supplier ?? '(미기재)';
      const c = m.get(k) ?? { total: 0, fail: 0 };
      c.total++;
      if (i.verdict === 'FAIL') c.fail++;
      m.set(k, c);
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v, rate: v.total ? v.fail / v.total : 0 }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [items]);

  // SKU 별 (product_name)
  const bySku = useMemo<RateRow[]>(() => {
    const m = new Map<string, { total: number; fail: number }>();
    for (const i of items) {
      const k = i.product_name ?? i.product_id;
      const c = m.get(k) ?? { total: 0, fail: 0 };
      c.total++;
      if (i.verdict === 'FAIL') c.fail++;
      m.set(k, c);
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v, rate: v.total ? v.fail / v.total : 0 }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [items]);

  // 월별 추이 (최근 6개월)
  const monthly = useMemo(() => {
    const m = new Map<string, { total: number; fail: number }>();
    for (const i of items) {
      const ym = i.inspected_at.slice(0, 7);
      const c = m.get(ym) ?? { total: 0, fail: 0 };
      c.total++;
      if (i.verdict === 'FAIL') c.fail++;
      m.set(ym, c);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([ym, v]) => ({ ym, ...v, rate: v.total ? Math.round((v.fail / v.total) * 100) : 0 }));
  }, [items]);

  // 불량 사유 Top 5 — mill/look 체크리스트 중 'ng' 빈도
  const topReasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) {
      for (const c of [...i.mill_checks, ...i.look_checks]) {
        if (c.r === 'ng') m.set(c.q, (m.get(c.q) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([q, count]) => ({ q, count }));
  }, [items]);

  if (!loaded) return <div className="text-sm text-gray-500">불러오는 중...</div>;

  return (
    <>
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">총 {items.length}건 기준 집계</div>
        <button onClick={refresh} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RateTable title="공급사별 불량률" rows={bySupplier} />
        <RateTable title="SKU 별 불량률" rows={bySku} />

        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-200">월별 추이 (최근 6개월)</CardTitle></CardHeader>
          <CardContent>
            {monthly.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">데이터 없음</div>
            ) : (
              <ul className="space-y-1.5">
                {monthly.map((m) => (
                  <li key={m.ym} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-400 font-mono">{m.ym}</span>
                    <div className="flex-1 h-3 rounded-full bg-[#0f1117] overflow-hidden">
                      <div
                        className={`h-full ${m.rate > 10 ? 'bg-red-500' : m.rate > 3 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(m.rate, 100)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs text-gray-400">
                      {m.fail}/{m.total} ({m.rate}%)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-200">불량 사유 Top 5</CardTitle></CardHeader>
          <CardContent>
            {topReasons.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">불량 사례 없음</div>
            ) : (
              <ol className="space-y-1.5 list-decimal list-inside">
                {topReasons.map((r) => (
                  <li key={r.q} className="text-sm text-gray-200">
                    {r.q} <span className="text-xs text-red-300 ml-1">({r.count}건)</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RateTable({ title, rows }: { title: string; rows: RateRow[] }) {
  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-200">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">데이터 없음</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase">
                <th className="text-left py-1">항목</th>
                <th className="text-right py-1 w-16">총</th>
                <th className="text-right py-1 w-16">불량</th>
                <th className="text-right py-1 w-20">비율</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = Math.round(r.rate * 100);
                const tone = pct >= 10 ? 'text-red-300' : pct >= 3 ? 'text-amber-300' : 'text-green-300';
                return (
                  <tr key={r.key} className="border-t border-[#1f2433]">
                    <td className="py-1.5 text-gray-200 truncate">{r.key}</td>
                    <td className="text-right py-1.5 text-gray-400">{r.total}</td>
                    <td className="text-right py-1.5 text-gray-400">{r.fail}</td>
                    <td className={`text-right py-1.5 font-semibold ${tone}`}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
