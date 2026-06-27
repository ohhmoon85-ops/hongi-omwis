// ============================================================================
// /api/cron/daily-summary — 매일 18:00 KST 관리자 데일리 운영 요약
// ----------------------------------------------------------------------------
// vercel.json 의 두 번째 crons 엔트리로 등록 — KST 18:00 = UTC 09:00
// 보안: Authorization: Bearer ${CRON_SECRET}
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/notifications/email';
import { formatKRW } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DailyData {
  date: string;            // YYYY-MM-DD (KST)
  // 주문
  ordersNew: number;
  ordersApproved: number;
  ordersRejected: number;
  ordersShipped: number;   // 오늘 출고 완료된 주문 건수
  ordersReturned: number;  // 오늘 반품 처리된 주문 건수
  revenue: number;
  // 입출고
  stockIn: number;        // log_type='in' 건수
  stockOut: number;       // log_type='out' 건수
  stockAdjust: number;    // log_type='adjust' 건수
  inboundQty: number;     // 입고 총량 (kg)
  outboundQty: number;    // 출고 총량 (kg)
  // 경보
  lowStockCount: number;
  // 세금계산서
  invoicesIssued: number;
}

// KST 오늘 0시 / 내일 0시 → UTC ISO
function kstTodayRange(): { startISO: string; endISO: string; date: string } {
  const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
  const y = nowKST.getUTCFullYear();
  const m = nowKST.getUTCMonth();
  const d = nowKST.getUTCDate();
  const start = new Date(Date.UTC(y, m, d) - 9 * 3600 * 1000);
  const end   = new Date(Date.UTC(y, m, d + 1) - 9 * 3600 * 1000);
  return {
    startISO: start.toISOString(),
    endISO:   end.toISOString(),
    date:     `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  };
}

async function aggregate(): Promise<DailyData> {
  const admin = createAdminClient();
  const { startISO, endISO, date } = kstTodayRange();

  // 1) 오늘 생성된 주문 (상태별 카운트 + 매출)
  const { data: orders } = await admin
    .from('orders')
    .select('status, total_amount, created_at')
    .gte('created_at', startISO).lt('created_at', endISO);

  const ord = (orders ?? []) as Array<{ status: string; total_amount: number }>;
  const ordersNew = ord.length;
  const ordersApproved = ord.filter((o) => o.status === 'approved').length;
  const ordersRejected = ord.filter((o) => o.status === 'rejected').length;
  const revenue = ord.reduce((s, o) => s + (o.total_amount ?? 0), 0);

  // 2) 오늘 출고/반품 처리된 주문 (상태 변경 시각 = updated_at 기준)
  const { count: shippedCount } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'shipped')
    .gte('updated_at', startISO).lt('updated_at', endISO);
  const { count: returnedCount } = await admin
    .from('returns')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startISO).lt('created_at', endISO);

  // 3) 오늘 입출고 (inventory_logs)
  const { data: logs } = await admin
    .from('inventory_logs')
    .select('log_type, quantity')
    .gte('created_at', startISO).lt('created_at', endISO);
  const lg = (logs ?? []) as Array<{ log_type: 'in' | 'out' | 'adjust'; quantity: number }>;
  const stockIn = lg.filter((l) => l.log_type === 'in').length;
  const stockOut = lg.filter((l) => l.log_type === 'out').length;
  const stockAdjust = lg.filter((l) => l.log_type === 'adjust').length;
  const inboundQty  = lg.filter((l) => l.log_type === 'in').reduce((s, l) => s + Math.abs(l.quantity), 0);
  const outboundQty = lg.filter((l) => l.log_type === 'out').reduce((s, l) => s + Math.abs(l.quantity), 0);

  // 4) 안전재고 미달 (현재 시점 스냅샷)
  const { data: safety } = await admin
    .from('safety_stock').select('product_id, min_quantity');
  const { data: lots } = await admin
    .from('inventory').select('product_id, quantity').eq('status', 'active');
  const totalMap = new Map<string, number>();
  for (const l of (lots ?? []) as Array<{ product_id: string; quantity: number }>) {
    totalMap.set(l.product_id, (totalMap.get(l.product_id) ?? 0) + Number(l.quantity));
  }
  let lowStockCount = 0;
  for (const s of (safety ?? []) as Array<{ product_id: string; min_quantity: number }>) {
    if ((totalMap.get(s.product_id) ?? 0) < Number(s.min_quantity)) lowStockCount++;
  }

  // 5) 오늘 발행된 세금계산서
  const { count: invoicesCount } = await admin
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startISO).lt('created_at', endISO);

  return {
    date,
    ordersNew, ordersApproved, ordersRejected,
    ordersShipped: shippedCount ?? 0,
    ordersReturned: returnedCount ?? 0,
    revenue,
    stockIn, stockOut, stockAdjust, inboundQty, outboundQty,
    lowStockCount,
    invoicesIssued: invoicesCount ?? 0,
  };
}

async function findAdminRecipients(): Promise<Array<{ email: string }>> {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id')
    .in('role', ['super_admin', 'admin']);

  const recipients: Array<{ email: string }> = [];
  for (const p of (profiles ?? []) as Array<{ id: string }>) {
    const { data: { user } } = await admin.auth.admin.getUserById(p.id);
    if (user?.email) recipients.push({ email: user.email });
  }
  return recipients;
}

function buildEmailHTML(d: DailyData): string {
  return `
    <h2 style="color:#1a3d6b;border-bottom:2px solid #c8962e;padding-bottom:8px;">
      📊 데일리 운영 요약 — ${d.date}
    </h2>

    <h3 style="color:#1a3d6b;margin-top:20px;">📦 주문</h3>
    <table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;">
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">신규 주문</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;"><b>${d.ordersNew}</b>건</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">승인 / 거절</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${d.ordersApproved} / ${d.ordersRejected}</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">금일 매출</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;color:#c8962e;font-weight:bold;">${formatKRW(d.revenue)}</td></tr>
    </table>

    <h3 style="color:#1a3d6b;margin-top:20px;">🚛 출고 / 반품</h3>
    <table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;">
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">출고 완료</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;"><b>${d.ordersShipped}</b>건</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">반품 접수</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;${d.ordersReturned > 0 ? 'color:#dc2626;font-weight:bold;' : ''}">${d.ordersReturned}건</td></tr>
    </table>

    <h3 style="color:#1a3d6b;margin-top:20px;">📋 재고</h3>
    <table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;">
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">입고 (in)</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${d.stockIn}건 / ${d.inboundQty.toLocaleString()}kg</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">출고 (out)</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${d.stockOut}건 / ${d.outboundQty.toLocaleString()}kg</td></tr>
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">조정 (실사 등)</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${d.stockAdjust}건</td></tr>
      ${d.lowStockCount > 0 ? `
      <tr><td style="padding:6px;border-bottom:1px solid #eee;color:#dc2626;">⚠ 안전재고 미달</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;color:#dc2626;font-weight:bold;">${d.lowStockCount}건</td></tr>
      ` : ''}
    </table>

    <h3 style="color:#1a3d6b;margin-top:20px;">📄 세금계산서</h3>
    <table style="border-collapse:collapse;width:100%;max-width:560px;font-family:sans-serif;">
      <tr><td style="padding:6px;border-bottom:1px solid #eee;">금일 발행</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;"><b>${d.invoicesIssued}</b>건</td></tr>
    </table>

    <p style="color:#666;font-size:12px;margin-top:24px;">
      상세 내역은 <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/dashboard"
        style="color:#1a3d6b;">관리자 대시보드</a>에서 확인하세요.
    </p>
  `;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const recipients = await findAdminRecipients();
    if (recipients.length === 0) {
      return NextResponse.json(
        { warning: 'admin/super_admin 역할 사용자 없음 — 데일리 요약 발송 건너뜀' },
        { status: 200 },
      );
    }

    const data = await aggregate();
    const html = buildEmailHTML(data);
    const subject = `[OMWIS] 데일리 운영 요약 ${data.date}`;

    // 각 관리자에게 sendEmail 직접 호출 (RESEND_API_KEY 미설정 시 Mock)
    const results = await Promise.allSettled(
      recipients.map((r) => sendEmail({ to: r.email, subject, html })),
    );
    const sent = results.filter((r) => r.status === 'fulfilled').length;

    return NextResponse.json({
      ok: true,
      data,
      sent,
      total: recipients.length,
      recipients: recipients.map((r) => r.email),
    });
  } catch (err) {
    console.error('[CRON daily-summary] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
