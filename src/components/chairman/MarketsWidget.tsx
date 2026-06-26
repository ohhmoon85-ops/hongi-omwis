// ============================================================================
// 회장 대시보드 — 환율/원자재 실시간 위젯 (서버 컴포넌트)
// ACIS 시계열 fetch → 4개 카드 + 미니 sparkline
// ----------------------------------------------------------------------------
// ⚠️ 회장 권한: 표시 전용 — 어떤 편집 UI 도 두지 말 것
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMarketSeries } from '@/lib/acis';
import { formatNumber } from '@/lib/utils';
import { Sparkline } from './Sparkline';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export async function MarketsWidget() {
  const m = await getMarketSeries();

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-300 flex items-center justify-between">
          <span>🌐 환율·원자재 시세 (최근 30일)</span>
          {m.is_mock && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
              MOCK
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            label="알루미늄 (SHFE)"
            value={`¥${formatNumber(m.latest.aluminum)}`}
            unit="/MT"
            change={m.change7d.aluminum}
            series={m.aluminum.map((p) => p.price)}
            accent="#c8962e"
          />
          <Tile
            label="LME 알루미늄"
            value={`$${formatNumber(m.latest.lme)}`}
            unit="/MT"
            change={m.change7d.lme}
            series={m.lme.map((p) => p.price)}
            accent="#60a5fa"
          />
          <Tile
            label="CNY / KRW"
            value={formatNumber(m.latest.cnyKrw, 2)}
            unit="원"
            change={m.change7d.cnyKrw}
            series={m.cnyKrw.map((p) => p.price)}
            accent="#f87171"
          />
          <Tile
            label="USD / KRW"
            value={formatNumber(m.latest.usdKrw, 2)}
            unit="원"
            change={m.change7d.usdKrw}
            series={m.usdKrw.map((p) => p.price)}
            accent="#34d399"
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-3 text-right">
          출처: ACIS · 7일 전 대비 변동률
        </p>
      </CardContent>
    </Card>
  );
}

function Tile({
  label, value, unit, change, series, accent,
}: {
  label: string;
  value: string;
  unit: string;
  change: number;
  series: number[];
  accent: string;
}) {
  const trend =
    change > 0.5 ? { icon: TrendingUp,  color: 'text-red-400'   }
    : change < -0.5 ? { icon: TrendingDown, color: 'text-green-400' }
    : { icon: Minus, color: 'text-gray-400' };
  const TrendIcon = trend.icon;

  return (
    <div className="bg-[#0f1117] border border-[#1f2433] rounded-lg p-3">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-lg font-bold" style={{ color: accent }}>{value}</span>
        <span className="text-[10px] text-gray-500">{unit}</span>
      </div>
      <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${trend.color}`}>
        <TrendIcon className="w-3 h-3" />
        {change > 0 ? '+' : ''}{formatNumber(change, 1)}%
        <span className="text-gray-500 ml-0.5">7일</span>
      </div>
      <div className="mt-2 h-10">
        <Sparkline data={series} color={accent} />
      </div>
    </div>
  );
}
