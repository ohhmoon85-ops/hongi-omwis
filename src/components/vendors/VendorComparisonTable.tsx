'use client';

// ============================================================================
// VendorComparisonTable — 후보 업체 샘플 평가 비교표
// ----------------------------------------------------------------------------
// 컬럼: 업체(위치) | SKU | 판정 | 두께편차 | 단가 | MOQ | 납기 | 결제 | 담당 | 평가일
// - 두께편차 = |측정 5점 - 기준 두께| 평균
// - PASS 중 두께편차 최소 업체 하이라이트
// - 출장 보고용 인쇄
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadDevInspectionsByPurpose } from '@/lib/dev-inspections';
import { fetchInspections } from '@/lib/inspections';
import { isDevMode } from '@/lib/dev-data';
import { formatDate } from '@/lib/utils';
import type { Inspection } from '@/types';
import { VERDICT_BADGE } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Printer, ChevronLeft } from 'lucide-react';

function thicknessDeviation(insp: Inspection, target: number): number | null {
  const pts = insp.thickness_points ?? [];
  const nums = pts.filter((p): p is number => p != null && !Number.isNaN(p));
  if (nums.length === 0) return null;
  const sum = nums.reduce((s, n) => s + Math.abs(n - target), 0);
  return sum / nums.length;
}

// dev 모드: product_id 는 'dev-raw-010-540' 같은 코드 → 기준 두께 파싱
function targetThicknessFromInspection(insp: Inspection): number | null {
  const id = insp.product_id;
  if (id.startsWith('dev-')) {
    const parts = id.replace('dev-', '').split('-');   // ['raw','010','540']
    if (parts.length >= 3) {
      const th = parseInt(parts[1], 10) / 100;
      return isFinite(th) ? th : null;
    }
  }
  return null;
}

export function VendorComparisonTable() {
  const [items, setItems] = useState<Inspection[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      const list = isDevMode
        ? loadDevInspectionsByPurpose('vendor_sample')
        : await fetchInspections('vendor_sample');
      setItems(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조회 실패');
    } finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); }, []);

  const rows = useMemo(() => items.map((i) => {
    const target = targetThicknessFromInspection(i);
    const dev = target != null ? thicknessDeviation(i, target) : null;
    return { insp: i, dev };
  }), [items]);

  // 최우수 (PASS 중 두께편차 최소)
  const bestId = useMemo(() => {
    const passes = rows.filter((r) => r.insp.verdict === 'PASS' && r.dev != null);
    if (passes.length === 0) return null;
    const sorted = [...passes].sort((a, b) => (a.dev ?? Infinity) - (b.dev ?? Infinity));
    return sorted[0].insp.id;
  }, [rows]);

  return (
    <>
      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-4 no-print">
        <Link href="/admin/vendors" className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> 업체 목록
        </Link>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="bg-[#1a3d6b] hover:bg-[#235490] text-white">
            <Printer className="w-4 h-4 mr-1" /> 비교표 인쇄 (A4 가로)
          </Button>
          <button onClick={refresh} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .cmp-table { color: #000 !important; font-size: 11px !important; }
          .cmp-table th { background: #12325e !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cmp-table td { background: #fff !important; color: #000 !important; }
          .cmp-table tr.best td { background: #e6f6ec !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-only { display: none; }
      `}</style>

      {/* 인쇄 헤더 (인쇄시에만) */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, color: '#12325e', borderBottom: '3px solid #c8962e', paddingBottom: 8 }}>
          HONGJEE 공급업체 발굴 평가 비교표
        </h1>
        <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
          출력 일시: {new Date().toLocaleString('ko-KR')}
        </p>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : items.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            업체 평가 기록이 없습니다. <br />
            <Link href="/admin/vendors/evaluate" className="text-[#c8962e] hover:underline mt-2 inline-block">
              샘플 평가 시작 →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-xs text-gray-400 mb-2 no-print">
            총 {items.length}건 · 합격 {items.filter((i) => i.verdict === 'PASS').length}건 ·
            {bestId && ' 최우수(초록 하이라이트): PASS 중 두께편차 최소'}
          </div>

          <div className="overflow-x-auto">
            <table className="cmp-table w-full text-xs text-gray-200 min-w-[900px]">
              <thead>
                <tr className="bg-[#12325e]/50 border-b border-purple-500/30">
                  {['업체 (위치)', 'SKU', '판정', '두께편차 (±mm)', '단가', 'MOQ', '납기', '결제', '담당·WeChat', '평가일'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ insp, dev }) => {
                  const badge = VERDICT_BADGE[insp.verdict];
                  const snap = insp.commercial_snapshot ?? {};
                  const isBest = insp.id === bestId;
                  return (
                    <tr
                      key={insp.id}
                      className={`border-b border-[#1f2433] ${
                        isBest ? 'best bg-green-500/10' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-2 py-2 font-semibold whitespace-nowrap">
                        <Link
                          href={`/admin/quality/${insp.id}`}
                          className="hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {insp.candidate_vendor_name ?? insp.supplier ?? '-'}
                        </Link>
                        {isBest && <span className="ml-1 text-[9px] text-green-300">★ 최우수</span>}
                      </td>
                      <td className="px-2 py-2">
                        {insp.product_name ?? '-'}
                      </td>
                      <td className={`px-2 py-2 font-bold ${
                        insp.verdict === 'PASS' ? 'text-green-300' : 'text-red-300'
                      }`}>
                        {badge.label}
                      </td>
                      <td className="px-2 py-2 font-mono">
                        {dev != null ? `±${dev.toFixed(3)}` : '-'}
                      </td>
                      <td className="px-2 py-2">{snap.price_note ?? '-'}</td>
                      <td className="px-2 py-2">{snap.moq ?? '-'}</td>
                      <td className="px-2 py-2">{snap.lead_time ?? '-'}</td>
                      <td className="px-2 py-2">{snap.payment_terms ?? '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{insp.lot_number}</td>
                      <td className="px-2 py-2 text-gray-400">{formatDate(insp.inspected_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-500 mt-3 no-print">
            💡 두께편차는 측정 5점의 |값 - 기준|의 평균입니다.
            상용 조건은 평가 시점 스냅샷이라 이후 업체가 조건을 변경해도 이 값이 보존됩니다.
          </p>
        </>
      )}
    </>
  );
}
