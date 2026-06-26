import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { calcVat } from '@/lib/company';
import { issueTaxInvoice, type InvoiceItemLine } from '@/lib/tax-invoice';
import { isDevMode } from '@/lib/dev-data';

// ─── POST: 주문에 대한 전자세금계산서 발행 ─────────────────────────────────
export async function POST(req: NextRequest) {
  if (isDevMode) {
    return NextResponse.json({ error: '개발 모드 미지원' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { order_id } = (await req.json()) as { order_id?: string };
  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 중복 발행 방지
  const { data: existing } = await admin
    .from('invoices').select('id, status').eq('order_id', order_id).maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: '이미 세금계산서가 발행된 주문입니다', invoice: existing },
      { status: 409 },
    );
  }

  // 주문 + 품목 + 거래처(사업자정보) 로드
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(`
      id, order_number, customer_id, total_amount,
      order_items(quantity, unit_price, subtotal, products(name)),
      customers(company_name, business_number, ceo_name, biz_type, biz_item, address, tax_email, email)
    `)
    .eq('id', order_id)
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = (order as any).customers;
  if (!customer?.business_number) {
    return NextResponse.json(
      { error: '거래처 사업자등록번호가 없습니다. 거래처 정보를 먼저 등록해 주세요.' },
      { status: 422 },
    );
  }

  // 부가세 별도 — order.total_amount = 공급가액
  const { supply, tax, total } = calcVat(order.total_amount ?? 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: InvoiceItemLine[] = ((order as any).order_items ?? []).map((it: any) => {
    const lineSupply = Math.round(it.subtotal ?? 0);
    return {
      name: it.products?.name ?? '품목',
      quantity: Number(it.quantity),
      unitPrice: it.unit_price,
      supply: lineSupply,
      tax: Math.round(lineSupply * 0.1),
    };
  });

  const mgtKey = order.order_number;
  const issueDate = new Date().toISOString().slice(0, 10);

  const result = await issueTaxInvoice({
    mgtKey,
    issueDate,
    buyer: {
      bizNumber: customer.business_number,
      name: customer.company_name,
      ceo: customer.ceo_name ?? '',
      address: customer.address ?? undefined,
      bizType: customer.biz_type ?? undefined,
      bizItem: customer.biz_item ?? undefined,
      email: customer.tax_email ?? customer.email ?? undefined,
    },
    items,
    supply, tax, total,
  });

  if (!result.success) {
    // 실패도 이력으로 남김
    await admin.from('invoices').insert({
      order_id, customer_id: order.customer_id, mgt_key: mgtKey,
      supply_amount: supply, tax_amount: tax, total_amount: total,
      status: 'failed', issue_date: issueDate, is_mock: result.mock,
      memo: result.error ?? null,
    });
    return NextResponse.json({ error: result.error ?? '발행 실패' }, { status: 502 });
  }

  const { data: invoice, error: insErr } = await admin
    .from('invoices')
    .insert({
      order_id,
      customer_id: order.customer_id,
      mgt_key: mgtKey,
      nts_confirm_number: result.ntsConfirmNumber ?? null,
      supply_amount: supply,
      tax_amount: tax,
      total_amount: total,
      status: 'issued',
      issue_date: issueDate,
      is_mock: result.mock,
    })
    .select()
    .single();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invoice });
}
