import Link from 'next/link';
import { User, Bot } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ACISCard } from '@/components/shared/ACISCard';
import { ACISQuoteCompareCard } from '@/components/shared/ACISQuoteCompareCard';
import { ChairmanCharts } from '@/components/chairman/ChairmanCharts';
import { MarketsWidget } from '@/components/chairman/MarketsWidget';
import { LogoutButton } from '@/components/shared/LogoutButton';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { createClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface ChairmanKPIs {
  stockLots: number | null;
  stockAlerts: number | null;
  receivables: number | null;
  overLimit: number | null;
  iqcTotal: number | null;
  iqcPassRate: number | null;
}

function monthStartISO(): string {
  const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
  const y = nowKST.getUTCFullYear();
  const m = nowKST.getUTCMonth();
  const KST = 9 * 3600 * 1000;
  return new Date(Date.UTC(y, m, 1) - KST).toISOString();
}

async function getChairmanKPIs(): Promise<ChairmanKPIs> {
  const empty: ChairmanKPIs = {
    stockLots: null, stockAlerts: null,
    receivables: null, overLimit: null,
    iqcTotal: null, iqcPassRate: null,
  };
  if (isDevMode) return empty;

  try {
    const supabase = createClient();
    const monthStart = monthStartISO();

    const [lotsRes, safetyRes, customersRes, iqcRes] = await Promise.all([
      supabase.from('inventory').select('product_id, quantity').eq('status', 'active'),
      supabase.from('safety_stock').select('product_id, min_quantity'),
      supabase.from('customers').select('current_balance, credit_limit, is_active').eq('is_active', true),
      supabase.from('inspections').select('verdict').gte('inspected_at', monthStart.slice(0, 10)),
    ]);

    // 재고
    const lots = lotsRes.data ?? [];
    const stockByProduct = new Map<string, number>();
    for (const l of lots) {
      stockByProduct.set(l.product_id, (stockByProduct.get(l.product_id) ?? 0) + Number(l.quantity ?? 0));
    }
    const stockAlerts = (safetyRes.data ?? []).filter(
      (s) => (stockByProduct.get(s.product_id) ?? 0) < Number(s.min_quantity ?? 0),
    ).length;

    // 미수금
    const customers = customersRes.data ?? [];
    const receivables = customers.reduce((s, c) => s + (c.current_balance ?? 0), 0);
    const overLimit = customers.filter(
      (c) => (c.current_balance ?? 0) > (c.credit_limit ?? 0) && (c.credit_limit ?? 0) > 0,
    ).length;

    // IQC
    const iqc = (iqcRes.data ?? []) as Array<{ verdict: string }>;
    const iqcTotal = iqc.length;
    const iqcPass = iqc.filter((i) => i.verdict === 'PASS').length;
    const iqcPassRate = iqcTotal > 0 ? Math.round((iqcPass / iqcTotal) * 100) : null;

    return {
      stockLots: lots.length,
      stockAlerts,
      receivables,
      overLimit,
      iqcTotal,
      iqcPassRate,
    };
  } catch (err) {
    console.error('[chairman] KPI fetch failed:', err);
    return empty;
  }
}

// 👑 회장 전용 모니터링 대시보드 — Read-Only
// ⚠️ 이 화면에는 어떤 편집·생성·삭제 UI 도 두지 말 것
export default async function ChairmanMonitorPage() {
  const kpi = await getChairmanKPIs();
  return (
    <div className="min-h-screen bg-app p-4 sm:p-6 text-white">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
            👑 회장 모니터링
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
          <p className="text-sm text-gray-400 mt-1">
            전사 현황을 실시간 열람 — 모든 데이터는 Read-Only
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-3 py-1 rounded-full bg-[#c8962e]/15 text-[#c8962e] border border-[#c8962e]/30">
            Read-Only
          </span>
          <ThemeToggle variant="dark" />
          <a
            href="/admin/acis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.06] transition"
            title="ACIS 새 탭에서 열기"
          >
            <Bot className="w-4 h-4" />
            ACIS
          </a>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.06] transition"
            title="내 계정"
          >
            <User className="w-4 h-4" />
            내 계정
          </Link>
          <LogoutButton variant="dark" />
        </div>
      </header>

      {/* KPI / IQC / ACIS 카드 (Read-Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="📋 재고 현황"
          subtitle="활성 lot · 안전재고 미달"
          value={kpi.stockLots == null ? '—' : `${kpi.stockLots} lot`}
          badge={kpi.stockAlerts == null ? null : {
            label: `경보 ${kpi.stockAlerts}`,
            tone: kpi.stockAlerts > 0 ? 'red' : 'green',
          }}
        />
        <KpiCard
          title="💰 미수금"
          subtitle="거래처 잔액 · 한도 초과"
          value={kpi.receivables == null ? '—' : formatKRW(kpi.receivables)}
          badge={kpi.overLimit == null ? null : {
            label: `초과 ${kpi.overLimit}`,
            tone: kpi.overLimit > 0 ? 'red' : 'green',
          }}
        />
        <KpiCard
          title="🔬 IQC 합격률"
          subtitle="이번 달 입고 검수"
          value={kpi.iqcPassRate == null ? '—' : `${kpi.iqcPassRate}%`}
          badge={kpi.iqcTotal == null ? null : {
            label: `${kpi.iqcTotal}건`,
            tone: kpi.iqcPassRate == null ? 'gray'
                : kpi.iqcPassRate >= 90 ? 'green'
                : kpi.iqcPassRate >= 70 ? 'amber' : 'red',
          }}
          tone={kpi.iqcPassRate == null ? 'default'
              : kpi.iqcPassRate >= 90 ? 'green'
              : kpi.iqcPassRate >= 70 ? 'amber' : 'red'}
        />
        <ACISCard />
      </div>

      {/* ACIS ⑥번 섹션 실시간 스냅샷 — 공급자 견적 상호 비교 (도착원가) */}
      <div className="mb-6">
        <ACISQuoteCompareCard />
      </div>

      {/* 환율/원자재 시세 위젯 — ACIS 시계열 */}
      <div className="mb-6">
        <MarketsWidget />
      </div>

      {/* 차트 섹션 — 매출 추세 / 거래처 순위 / 주문 상태 */}
      <ChairmanCharts />

      <footer className="mt-8 text-center text-xs text-gray-500">
        경영 지표는 실시간 집계 — ACIS 구매 신호 · IQC 검수 · 재고·미수금 실데이터 연동됨
      </footer>
    </div>
  );
}

// ─── KPI 카드 (Read-Only) ────────────────────────────────────────────────────
function KpiCard({
  title, subtitle, value, badge, tone = 'default',
}: {
  title: string;
  subtitle: string;
  value: string;
  badge?: { label: string; tone: 'green' | 'red' | 'amber' | 'gray' } | null;
  tone?: 'default' | 'green' | 'amber' | 'red';
}) {
  const valueColor = {
    default: 'text-[#c8962e]',
    green:   'text-green-400',
    amber:   'text-amber-400',
    red:     'text-red-400',
  }[tone];

  const badgeColor = badge && {
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    red:   'bg-red-500/20 text-red-300 border-red-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    gray:  'bg-gray-500/20 text-gray-300 border-gray-500/30',
  }[badge.tone];

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-gray-200">{title}</CardTitle>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${valueColor}`}>{value}</div>
          {badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {badge.label}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
