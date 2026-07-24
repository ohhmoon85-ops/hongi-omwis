import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  getQuoteComparison,
  QUOTE_PRODUCT_LABELS,
  ACIS_APP_URL,
} from '@/lib/acis';
import { formatNumber } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

// 관리자·회장 공용 — ACIS ⑥번 섹션의 "공급자 견적 상호 비교 (도착원가)" 실시간 스냅샷.
// USD/KRW 는 ACIS /api/rates(Yahoo Finance) 실시간값 → 도착원가 원/톤 자동 재계산.
export async function ACISQuoteCompareCard() {
  const { quotes, params, best, is_mock, fetched_at } = await getQuoteComparison();

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-300 flex items-center justify-between flex-wrap gap-2">
          <span>📊 공급자 견적 상호 비교 <span className="text-gray-500 text-xs">(도착원가 기준 · 실시간)</span></span>
          <span className="flex items-center gap-2">
            {is_mock && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                MOCK
              </span>
            )}
            {ACIS_APP_URL && (
              <a
                href={ACIS_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#c8962e]/40 bg-[#c8962e]/10 text-xs font-semibold text-[#c8962e] hover:bg-[#c8962e]/20 transition"
              >
                ACIS에서 편집 <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 최저가 하이라이트 */}
        {best && (
          <div className="flex items-baseline gap-3 flex-wrap bg-[#0f1117] border border-[#1f2433] rounded-lg px-4 py-3">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">실시간 최저 도착원가</span>
            <span className="text-2xl font-extrabold text-green-400 tabular-nums">
              {formatNumber(best.totalKrw)}
              <span className="text-xs text-gray-500 font-normal ml-1">원/톤</span>
            </span>
            <span className="text-xs text-gray-300">
              {best.supplier} · {QUOTE_PRODUCT_LABELS[best.product]}
            </span>
          </div>
        )}

        {/* 계산 파라미터 (실시간 환율 노출) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-gray-400">
          <div>USD/KRW <span className="text-gray-200 tabular-nums">{formatNumber(params.usdKrw, 2)}</span></div>
          <div>USD/CNY <span className="text-gray-200 tabular-nums">{formatNumber(params.usdCny, 3)}</span></div>
          <div>관세 <span className="text-gray-200">{params.tariff}%</span></div>
          <div>부대비 <span className="text-gray-200 tabular-nums">{formatNumber(params.overhead)}원/톤</span></div>
        </div>

        {/* 견적 비교 테이블 */}
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-[#1f2433]">
                <th className="text-left font-medium px-2 py-2">공급자</th>
                <th className="text-left font-medium px-2 py-2">품목</th>
                <th className="text-right font-medium px-2 py-2">견적</th>
                <th className="text-right font-medium px-2 py-2">CIF 원/톤</th>
                <th className="text-right font-medium px-2 py-2">관세</th>
                <th className="text-right font-medium px-2 py-2">도착 원/톤</th>
                <th className="text-right font-medium px-2 py-2">원/kg</th>
                <th className="text-right font-medium px-2 py-2">국내가 대비</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-[#1f2433]/60 hover:bg-white/[0.02]">
                  <td className="px-2 py-2 text-gray-200 whitespace-nowrap">{q.supplier}</td>
                  <td className="px-2 py-2 text-gray-300 whitespace-nowrap">
                    {QUOTE_PRODUCT_LABELS[q.product]}
                    {q.cut && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-white/[0.05] text-gray-400">절단</span>}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-400 tabular-nums whitespace-nowrap">
                    {q.inco} {q.currency === 'USD' ? '$' : '¥'}{formatNumber(q.pricePerTon)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-300 tabular-nums">{formatNumber(q.cifKrw)}</td>
                  <td className="px-2 py-2 text-right text-gray-400 tabular-nums">{formatNumber(q.tariffKrw)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums font-semibold ${q.isWinner ? 'text-green-400' : 'text-gray-100'}`}>
                    {formatNumber(q.totalKrw)}
                    {q.isWinner && (
                      <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 align-middle">
                        최저
                      </span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${q.isWinner ? 'text-green-400 font-semibold' : 'text-gray-300'}`}>
                    {formatNumber(q.perKg)}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${q.marginPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {q.marginPct >= 0 ? '+' : ''}{q.marginPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-gray-500 leading-relaxed pt-1 border-t border-[#1f2433]">
          도착원가 = (CIF USD × USD/KRW) × (1 + 관세율) + 부대비 · 국내가 기준 {formatNumber(params.domestic)}원/kg ·
          동일 품목 2건 이상일 때 최저가에 <span className="text-green-400">최저</span> 배지 · 최종 갱신 {new Date(fetched_at).toLocaleTimeString('ko-KR')}
        </p>
      </CardContent>
    </Card>
  );
}
