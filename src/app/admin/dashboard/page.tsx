import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ACISCard } from '@/components/shared/ACISCard';
import { createClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW } from '@/lib/utils';
import { ACIS_APP_URL } from '@/lib/acis';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── KPI 집계 (실 Supabase) ──────────────────────────────────────────────
interface DashboardKPIs {
  todayOrders: number | null;
  deliveriesInProgress: number | null;
  deliveriesDone: number | null;
  monthRevenue: number | null;
  stockAlerts: number | null;
  receivables: number | null;
}

// KST 기준 '이번 달 1일'·'오늘 0시'의 UTC 순간을 ISO 로 반환
function kstBoundaries() {
  const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
  const y = nowKST.getUTCFullYear();
  const m = nowKST.getUTCMonth();
  const d = nowKST.getUTCDate();
  const KST = 9 * 3600 * 1000;
  return {
    monthStart: new Date(Date.UTC(y, m, 1) - KST).toISOString(),
    todayStart: new Date(Date.UTC(y, m, d) - KST).toISOString(),
  };
}

async function getKPIs(): Promise<DashboardKPIs> {
  const empty: DashboardKPIs = {
    todayOrders: null, deliveriesInProgress: null, deliveriesDone: null,
    monthRevenue: null, stockAlerts: null, receivables: null,
  };
  if (isDevMode) return empty;

  try {
    const supabase = createClient();
    const { monthStart, todayStart } = kstBoundaries();

    const [ordersRes, deliveriesRes, customersRes, inventoryRes, safetyRes] =
      await Promise.all([
        supabase.from('orders').select('total_amount, created_at').gte('created_at', monthStart),
        supabase.from('deliveries').select('status'),
        supabase.from('customers').select('current_balance'),
        supabase.from('inventory').select('product_id, quantity').eq('status', 'active'),
        supabase.from('safety_stock').select('product_id, min_quantity'),
      ]);

    const orders = ordersRes.data ?? [];
    const todayOrders = orders.filter((o) => o.created_at >= todayStart).length;
    const monthRevenue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);

    const deliveries = deliveriesRes.data ?? [];
    const deliveriesInProgress = deliveries.filter(
      (d) => d.status === 'scheduled' || d.status === 'departed',
    ).length;
    const deliveriesDone = deliveries.filter((d) => d.status === 'delivered').length;

    const receivables = (customersRes.data ?? []).reduce(
      (s, c) => s + (c.current_balance ?? 0), 0,
    );

    // 품목별 활성 재고 합계 vs 안전재고 최소치
    const stockByProduct = new Map<string, number>();
    for (const row of inventoryRes.data ?? []) {
      stockByProduct.set(
        row.product_id,
        (stockByProduct.get(row.product_id) ?? 0) + Number(row.quantity ?? 0),
      );
    }
    const stockAlerts = (safetyRes.data ?? []).filter(
      (s) => (stockByProduct.get(s.product_id) ?? 0) < Number(s.min_quantity ?? 0),
    ).length;

    return {
      todayOrders, deliveriesInProgress, deliveriesDone,
      monthRevenue, stockAlerts, receivables,
    };
  } catch (err) {
    console.error('[dashboard] KPI fetch failed:', err);
    return empty;
  }
}

// ACIS 구매 신호는 회장·슈퍼관리자 전용 — 일반 운영 관리자에게는 미노출
async function currentRole(): Promise<string | null> {
  if (isDevMode) return null;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    return data?.role ?? null;
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const [kpi, role] = await Promise.all([getKPIs(), currentRole()]);
  const canSeeACIS = role === 'super_admin';

  const cards = [
    {
      icon: '📦', title: '오늘의 주문', color: 'text-blue-400', desc: '실시간',
      value: kpi.todayOrders == null ? '-' : `${kpi.todayOrders}건`,
    },
    {
      icon: '🚛', title: '배송 현황', color: 'text-green-400', desc: '진행 / 완료',
      value: kpi.deliveriesInProgress == null
        ? '-'
        : `${kpi.deliveriesInProgress} / ${kpi.deliveriesDone}`,
    },
    {
      icon: '📊', title: '이번 달 매출', color: 'text-[#c8962e]', desc: '월 누계',
      value: kpi.monthRevenue == null ? '-' : formatKRW(kpi.monthRevenue),
    },
    {
      icon: '⚠️', title: '재고 경보', color: 'text-red-400', desc: '안전재고 미달 품목',
      value: kpi.stockAlerts == null ? '-' : `${kpi.stockAlerts}건`,
    },
    {
      icon: '💰', title: '미수금 현황', color: 'text-orange-400', desc: '거래처 잔액 총계',
      value: kpi.receivables == null ? '-' : formatKRW(kpi.receivables),
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
            관리자 대시보드
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
          <p className="text-sm text-gray-400 mt-1">매일 아침 핵심 경영 지표 한눈에</p>
        </div>
        {canSeeACIS && ACIS_APP_URL && (
          <div className="flex items-center gap-2">
            <Link
              href="/admin/acis"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c8962e] hover:bg-[#b3851f] text-white text-sm font-semibold transition shadow"
            >
              🤖 ACIS 임베드 보기
            </Link>
            <a
              href={ACIS_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#c8962e]/40 text-[#c8962e] hover:bg-[#c8962e]/10 text-sm font-semibold transition"
              title="새 탭으로 ACIS 열기"
            >
              새 탭 <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card
            key={c.title}
            className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white hover:ring-white/[0.10] hover:-translate-y-0.5"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-gray-400">
                <span className="mr-2 text-sm">{c.icon}</span>{c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${c.color}`}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-1.5">{c.desc}</div>
            </CardContent>
          </Card>
        ))}
        {canSeeACIS && <ACISCard />}
      </div>

      <footer className="mt-8 text-xs text-gray-500">
        {isDevMode
          ? '개발 모드 — KPI 는 Supabase 연결 시 실데이터로 표시됩니다.'
          : 'KPI 실데이터 연결됨 — 주문·배송·재고·미수금 실시간 집계'}
      </footer>
    </div>
  );
}
