'use client';

// ============================================================================
// QualityList — 검수 이력 목록 (dev + real 모드)
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDevInspections } from '@/lib/dev-inspections';
import { fetchInspections } from '@/lib/inspections';
import { isDevMode } from '@/lib/dev-data';
import { formatDate } from '@/lib/utils';
import type { Inspection } from '@/types';
import { VERDICT_BADGE } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Search, BarChart3, Sliders } from 'lucide-react';

export function QualityList() {
  const [items, setItems] = useState<Inspection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'PASS' | 'FAIL'>('all');
  const [query, setQuery] = useState('');

  async function refresh() {
    try {
      setItems(isDevMode ? loadDevInspections() : await fetchInspections());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '검수 조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { refresh(); }, []);

  const filtered = items.filter((i) => {
    if (filter !== 'all' && i.verdict !== filter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        i.lot_number.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q) ||
        i.product_name?.toLowerCase().includes(q) ||
        i.inspector?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const passCount = items.filter((i) => i.verdict === 'PASS').length;
  const failCount = items.filter((i) => i.verdict === 'FAIL').length;
  const passRate = items.length > 0 ? Math.round((passCount / items.length) * 100) : null;

  return (
    <>
      <Toaster position="top-center" />

      {/* 상단 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="총 검수" value={`${items.length}건`} />
        <SummaryCard label="합격" value={`${passCount}건`} tone="green" />
        <SummaryCard label="불합격" value={`${failCount}건`} tone="red" />
        <SummaryCard label="합격률" value={passRate == null ? '—' : `${passRate}%`} tone={passRate != null && passRate >= 90 ? 'green' : 'amber'} />
      </div>

      {/* 필터 + 검색 + 통계 링크 */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex gap-1">
          {(['all', 'PASS', 'FAIL'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === k
                  ? 'bg-[#1a3d6b] text-white border-[#1a3d6b]'
                  : 'bg-[#171b26] text-gray-300 border-[#2a2f3e] hover:border-[#1a3d6b]'
              }`}
            >
              {k === 'all' ? '전체' : VERDICT_BADGE[k].label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="로트·공급사·SKU·검수자 검색"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-[#2a2f3e] bg-[#171b26] text-white text-sm"
          />
        </div>
        <Link
          href="/admin/quality/stats"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#c8962e]/15 text-[#e0bf70] border border-[#c8962e]/30 hover:bg-[#c8962e]/25"
        >
          <BarChart3 className="w-3.5 h-3.5" /> 품질 통계
        </Link>
        <Link
          href="/admin/quality/specs"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#171b26] text-gray-300 border border-[#2a2f3e] hover:border-[#1a3d6b]"
        >
          <Sliders className="w-3.5 h-3.5" /> 검수 기준
        </Link>
        <button onClick={refresh} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            {items.length === 0
              ? '검수 이력이 없습니다. /admin/inventory/stock-in 에서 시작하세요.'
              : '조건에 맞는 검수가 없습니다.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => {
            const badge = VERDICT_BADGE[i.verdict];
            return (
              <Link key={i.id} href={`/admin/quality/${i.id}`}>
                <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] hover:ring-white/[0.10] transition text-white cursor-pointer">
                  <CardContent className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="font-mono text-sm">{i.lot_number}</span>
                      <span className="text-sm text-gray-300 truncate">{i.product_name ?? i.product_id}</span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {formatDate(i.inspected_at)}
                        {i.supplier && ` · ${i.supplier}`}
                        {i.inspector && ` · ${i.inspector}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {isDevMode && (
        <p className="mt-6 text-xs text-amber-400">
          🛠️ 개발 모드 — 검수는 브라우저 localStorage 에 저장됩니다.
        </p>
      )}
    </>
  );
}

function SummaryCard({
  label, value, tone = 'default',
}: {
  label: string; value: string;
  tone?: 'default' | 'green' | 'red' | 'amber';
}) {
  const toneClass = {
    default: 'text-white',
    green:   'text-green-400',
    red:     'text-red-400',
    amber:   'text-amber-400',
  }[tone];
  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
      <CardContent className="py-3">
        <div className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</div>
        <div className={`text-2xl font-bold mt-0.5 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
