import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ACISCard } from '@/components/shared/ACISCard';
import { createClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW } from '@/lib/utils';

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

const QUICK_LINKS = [
  { href: '/admin/orders',     label: '📋 주문 관리',    desc: '승인·거절·납기조정·세금계산서·배송' },
  { href: '/admin/customers',  label: '🏢 거래처 관리',  desc: '등록·D2C 이관 관리·신용 한도' },
  { href: '/admin/inventory',  label: '📦 재고 관리',    desc: '입고·Lot·재고 조정·안전재고' },
  { href: '/admin/deliveries', label: '🚛 배송 관리',    desc: '배차·출발·배송 완료' },
];

export default async function AdminDashboardPage() {
  const kpi = await getKPIs();

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
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-gray-400 mt-1">매일 아침 핵심 경영 지표 한눈에</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="bg-[#171b26] border-[#1f2433] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-300">
                <span className="mr-2">{c.icon}</span>{c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
            </CardContent>
          </Card>
        ))}
        <ACISCard />
      </div>

      <section className="mt-8">
        <div className="text-xs text-gray-400 mb-2">바로가기</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              <Card className="bg-[#171b26] border-[#1f2433] text-white hover:border-[#1a3d6b] transition cursor-pointer">
                <CardContent className="py-4">
                  <div className="text-base font-semibold text-gray-200">{l.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{l.desc}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-8 text-xs text-gray-500">
        {isDevMode
          ? '개발 모드 — KPI 는 Supabase 연결 시 실데이터로 표시됩니다.'
          : 'KPI 실데이터 연결됨 — 주문·배송·재고·미수금 실시간 집계'}
      </footer>
    </div>
  );
}
