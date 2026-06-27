import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getACISSignal, ACIS_SIGNAL_BADGE, ACIS_APP_URL } from '@/lib/acis';
import { formatNumber } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

// 관리자·회장 대시보드 공용 — ACIS 구매 신호 카드
export async function ACISCard() {
  const s = await getACISSignal();
  const badge = ACIS_SIGNAL_BADGE[s.signal];

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-300 flex items-center justify-between">
          <span>🤖 ACIS 구매 신호</span>
          <span className="flex items-center gap-2">
            {s.is_mock && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                MOCK
              </span>
            )}
            {ACIS_APP_URL && (
              <a
                href={ACIS_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#c8962e]/40 bg-[#c8962e]/10 text-sm font-semibold text-[#c8962e] hover:bg-[#c8962e]/20 transition"
              >
                열기 <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${badge.color}`}>
          {badge.label}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400">
          <div>SPI</div><div className="text-right text-gray-200">{formatNumber(s.spi, 1)}</div>
          <div>ERI</div><div className="text-right text-gray-200">{formatNumber(s.eri, 2)}</div>
          <div>LME</div><div className="text-right text-gray-200">${formatNumber(s.lme_price)}/t</div>
          <div>CNY/KRW</div><div className="text-right text-gray-200">{formatNumber(s.cny_krw, 2)}</div>
          <div>RPCI</div><div className="text-right text-gray-200">{formatNumber(s.rpci)}</div>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed pt-1 border-t border-[#1f2433]">
          {s.recommendation}
        </p>
      </CardContent>
    </Card>
  );
}
