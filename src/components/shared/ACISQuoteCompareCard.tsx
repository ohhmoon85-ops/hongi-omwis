import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  getQuoteComparison,
  QUOTE_PRODUCT_LABELS,
  ACIS_APP_URL,
  type ComputedQuote,
  type QuoteProduct,
} from '@/lib/acis';
import { formatNumber } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { AutoRefresh } from './AutoRefresh';

// 10분 = 600,000 ms — 환율·SHFE/LME 실시간성 확보
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// ACIS ⑥번 섹션 실시간 스냅샷 — 필요한 3개 카테고리(생알미늄·DOS Oil·지용성)만
// 도착 최저가로 요약. USD/KRW 는 ACIS /api/rates 실시간값 사용.
export async function ACISQuoteCompareCard() {
  const { quotes, params, is_mock, fetched_at } = await getQuoteComparison();

  const categories: Array<{ key: string; label: string; products: QuoteProduct[] }> = [
    { key: 'raw', label: '생알미늄',    products: ['raw-coil', 'raw-sheet'] },
    { key: 'dos', label: 'DOS Oil',    products: ['dos-coil', 'dos-sheet'] },
    { key: 'oil', label: '지용성 코팅', products: ['oil'] },
  ];

  const tiles = categories.map((c) => {
    const filtered = quotes.filter((q) => c.products.includes(q.product));
    const best = filtered.reduce<ComputedQuote | null>(
      (acc, q) => (!acc || q.totalKrw < acc.totalKrw ? q : acc),
      null,
    );
    return { ...c, best, count: filtered.length };
  });

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-300 flex items-center justify-between flex-wrap gap-2">
          <span>📊 공급자 견적 도착 최저가 <span className="text-gray-500 text-xs">(실시간)</span></span>
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
                ACIS 견적 편집 <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div key={t.key} className="bg-[#0f1117] border border-[#1f2433] rounded-lg p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t.label}</div>
              {t.best ? (
                <>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-green-400 tabular-nums leading-none">
                      {formatNumber(t.best.totalKrw)}
                    </span>
                    <span className="text-[11px] text-gray-500">원/톤</span>
                  </div>
                  <div className="text-xs text-gray-400 tabular-nums mt-1">
                    {formatNumber(t.best.perKg)} 원/kg
                  </div>
                  <div className="text-[11px] text-gray-300 mt-2 leading-snug">
                    {t.best.supplier} · {QUOTE_PRODUCT_LABELS[t.best.product]}
                    {t.count > 1 && (
                      <span className="text-gray-500 ml-1">({t.count}건 중 최저)</span>
                    )}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${t.best.marginPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    국내가 대비 {t.best.marginPct >= 0 ? '+' : ''}{t.best.marginPct.toFixed(1)}%
                  </div>
                </>
              ) : (
                <div className="mt-3 text-sm text-gray-500">견적 미확보</div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-gray-500 pt-3 border-t border-[#1f2433]">
          <div>USD/KRW <span className="text-gray-300 tabular-nums">{formatNumber(params.usdKrw, 2)}</span></div>
          <div>관세 <span className="text-gray-300">{params.tariff}%</span></div>
          <div>부대비 <span className="text-gray-300 tabular-nums">{formatNumber(params.overhead)}원/톤</span></div>
          <div className="sm:text-right">
            갱신 {new Date(fetched_at).toLocaleTimeString('ko-KR', {
              hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
            })}
            <span className="text-gray-600 ml-1">· 10분 자동</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
