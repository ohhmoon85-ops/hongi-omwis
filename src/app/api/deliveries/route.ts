import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notifications';
import { isDevMode } from '@/lib/dev-data';

// 배송 건의 알림 대상(거래처 연락처)·주문번호·배송지 조회
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadNotifyTarget(admin: any, deliveryId: string) {
  const { data } = await admin
    .from('deliveries')
    .select('delivery_address, orders(order_number, customers(phone, email, company_name))')
    .eq('id', deliveryId)
    .single();
  const order = data?.orders;
  const customer = order?.customers;
  return {
    order_number: order?.order_number ?? '-',
    address: data?.delivery_address ?? '-',
    phone: customer?.phone ?? undefined,
    email: customer?.email ?? undefined,
  };
}

// ─── PATCH: 배송 상태 변경 (출발 / 배송완료) ────────────────────────────────
// driver 는 orders UPDATE 권한이 없으므로 service_role 로 배송+주문을 함께 갱신.
// 호출자 역할을 먼저 검증한다.
export async function PATCH(req: NextRequest) {
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
  const role = profile?.role;
  if (!role || !['driver', 'admin', 'super_admin'].includes(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { delivery_id, action } = (await req.json()) as {
    delivery_id?: string;
    action?: 'depart' | 'complete';
  };
  if (!delivery_id || (action !== 'depart' && action !== 'complete')) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  if (action === 'depart') {
    const { error } = await admin
      .from('deliveries')
      .update({ status: 'departed', departure_time: nowIso })
      .eq('id', delivery_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 거래처에 배송 출발 알림톡
    const t = await loadNotifyTarget(admin, delivery_id);
    await dispatchNotification({
      event: 'delivery_depart',
      to: { phone: t.phone, email: t.email },
      variables: { order_number: t.order_number, address: t.address },
    });

    return NextResponse.json({ ok: true, status: 'departed' });
  }

  // action === 'complete' — 배송 완료 + 주문 delivered 동기화
  const { data: del, error: delErr } = await admin
    .from('deliveries')
    .update({ status: 'delivered', arrival_time: nowIso })
    .eq('id', delivery_id)
    .select('order_id')
    .single();
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (del?.order_id) {
    await admin
      .from('orders')
      .update({ status: 'delivered', updated_at: nowIso })
      .eq('id', del.order_id);
  }

  // 거래처에 배송 완료 알림톡 + 이메일
  const t = await loadNotifyTarget(admin, delivery_id);
  await dispatchNotification({
    event: 'delivery_done',
    to: { phone: t.phone, email: t.email },
    variables: { order_number: t.order_number, completed_at: nowIso },
  });

  return NextResponse.json({ ok: true, status: 'delivered' });
}
