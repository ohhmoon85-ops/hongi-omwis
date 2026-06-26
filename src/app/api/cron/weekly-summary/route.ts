// ============================================================================
// /api/cron/weekly-summary — 회장 주간 경영 요약 자동 발송
// ----------------------------------------------------------------------------
// 호출 주기: 매주 월요일 09:00 KST (= 00:00 UTC, vercel.json 의 crons 설정)
// 보안: Vercel Cron 만 Authorization: Bearer ${CRON_SECRET} 헤더로 접근 가능.
//       로컬 테스트 시에도 동일 헤더 필요 → curl -H "Authorization: Bearer ..."
// 의존: dispatchNotification (kakao + email) — 카카오 미설정이면 콘솔 Mock.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notifications';
import { formatKRW, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface WeeklyData {
  period: string;            // 표시용 — "2026-06-16 ~ 2026-06-22"
  order_count: number;
  revenue: number;
  shipping_count: number;
  receivable: number;
  low_stock_count: number;
  top_customers: Array<{ name: string; amount: number }>;
}

function lastWeekRange(): { start: Date; end: Date; label: string } {
  // 월요일 00:00 KST 에 호출 → 지난주 월(=오늘-7일)~일(=오늘-1일) 까지 7일
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - 1);  // 일요일 23:59
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // 월요일 00:00
  start.setHours(0, 0, 0, 0);
  return {
    start, end,
    label: `${formatDate(start)} ~ ${formatDate(end)}`,
  };
}

async function aggregate(): Promise<WeeklyData> {
  const supabase = createAdminClient();
  const { start, end, label } = lastWeekRange();
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // 1) 주문 (지난주 생성된 모든 주문)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_amount, status, customer_id, customers(company_name)')
    .gte('created_at', startISO)
    .lte('created_at', endISO);

  const order_count = orders?.length ?? 0;
  const revenue = (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

  // 거래처별 매출 상위 3
  const customerMap = new Map<string, { name: string; amount: number }>();
  for (const o of orders ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (o as any).customers?.company_name ?? '-';
    const prev = customerMap.get(o.customer_id) ?? { name, amount: 0 };
    prev.amount += o.total_amount ?? 0;
    customerMap.set(o.customer_id, prev);
  }
  const top_customers = [...customerMap.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // 2) 진행 중 배송 (지금 시점에서 shipping/processing/ready)
  const { count: shippingCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['processing', 'ready', 'shipping']);

  // 3) 총 미수금
  const { data: customers } = await supabase
    .from('customers').select('current_balance').eq('is_active', true);
  const receivable = (customers ?? []).reduce((s, c) => s + (c.current_balance ?? 0), 0);

  // 4) 안전재고 미달 — products × safety_stock 비교
  const { data: safety } = await supabase
    .from('safety_stock').select('product_id, min_quantity');
  const safetyMap = new Map((safety ?? []).map((s) => [s.product_id, Number(s.min_quantity)]));

  const { data: lots } = await supabase
    .from('inventory').select('product_id, quantity').eq('status', 'active');
  const totalMap = new Map<string, number>();
  for (const l of lots ?? []) {
    totalMap.set(l.product_id, (totalMap.get(l.product_id) ?? 0) + Number(l.quantity));
  }
  let low_stock_count = 0;
  for (const [pid, min] of safetyMap) {
    if ((totalMap.get(pid) ?? 0) < min) low_stock_count++;
  }

  return {
    period: label,
    order_count,
    revenue,
    shipping_count: shippingCount ?? 0,
    receivable,
    low_stock_count,
    top_customers,
  };
}

async function findChairmanRecipient(): Promise<{ email?: string; phone?: string } | null> {
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('user_profiles').select('id').eq('role', 'chairman').limit(1).maybeSingle();
  if (!profile) return null;
  const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
  return {
    email: user?.email ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    phone: ((user?.user_metadata as any)?.phone ?? undefined) as string | undefined,
  };
}

function buildEmailHTML(d: WeeklyData): string {
  const topList = d.top_customers.length === 0
    ? '<li>주문 없음</li>'
    : d.top_customers.map((c) => `<li>${c.name} — ${formatKRW(c.amount)}</li>`).join('');
  return `
    <h2 style="color:#1a3d6b;border-bottom:2px solid #c8962e;padding-bottom:8px;">
      주간 경영 요약 (${d.period})
    </h2>
    <table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;">
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">📦 신규 주문</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${d.order_count}건</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">💰 매출</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#c8962e;font-weight:bold;">
            ${formatKRW(d.revenue)}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">🚛 진행 중 배송</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${d.shipping_count}건</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">📒 총 미수금</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatKRW(d.receivable)}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">⚠️ 재고 경보</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${d.low_stock_count}건</td></tr>
    </table>
    <h3 style="color:#1a3d6b;margin-top:24px;">상위 거래처</h3>
    <ol style="font-family:sans-serif;">${topList}</ol>
    <p style="color:#666;font-size:12px;margin-top:24px;">
      상세 내역은 <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/chairman/monitor"
        style="color:#1a3d6b;">경영 모니터링 대시보드</a>에서 확인하실 수 있습니다.
    </p>
  `;
}

export async function GET(req: NextRequest) {
  // 1) 보안 — Vercel Cron 검증
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 2) 회장 수신자 조회
    const recipient = await findChairmanRecipient();
    if (!recipient || (!recipient.email && !recipient.phone)) {
      return NextResponse.json(
        { warning: 'chairman 역할 사용자 없음 — 주간 리포트 발송 건너뜀' },
        { status: 200 },
      );
    }

    // 3) 지난주 데이터 집계
    const data = await aggregate();

    // 4) 카카오 + 이메일 디스패치
    await dispatchNotification({
      event: 'weekly_summary',
      to: { email: recipient.email, phone: recipient.phone },
      variables: {
        period: data.period,
        order_count: data.order_count,
        revenue: data.revenue,
        shipping_count: data.shipping_count,
        receivable: data.receivable,
        low_stock_count: data.low_stock_count,
        summary_html: buildEmailHTML(data),  // index.ts EVENT_CONFIG.weekly_summary 가 사용
      },
    });

    return NextResponse.json({ ok: true, data, recipient: { email: recipient.email } });
  } catch (err) {
    console.error('[CRON weekly-summary] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
