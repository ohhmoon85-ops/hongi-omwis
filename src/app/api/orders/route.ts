import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notifications';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

// ─── POST: 거래처 주문 접수 ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (isDevMode) {
    return apiError('validation', '개발 모드에서는 클라이언트 localStorage 를 사용합니다');
  }

  const body = await req.json();
  const { items, requested_date, memo } = body as {
    items: Array<{ product_id: string; quantity: number; unit_price: number }>;
    requested_date: string;
    memo?: string;
  };

  if (!items?.length) {
    return apiError('validation', '품목을 1개 이상 입력해주세요');
  }

  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return apiError('unauthorized');
  }

  const { data: profile } = await supabase
    .from('user_profiles').select('role, customer_id').eq('id', user.id).single();
  // 명시적 role 검증: customer 만 자사 주문 생성 가능
  // (createAdminClient 가 service_role 로 RLS 우회 후 INSERT 하므로 API 단에서 보강)
  if (!profile || profile.role !== 'customer') {
    return apiError('forbidden', '거래처 계정만 주문할 수 있습니다');
  }
  if (!profile.customer_id) {
    return apiError('forbidden', '거래처 프로필이 연결되어 있지 않습니다. 관리자에게 문의하세요.');
  }

  // service role 클라이언트로 주문번호 생성 + 인서트
  const admin = createAdminClient();

  const { data: orderNumberRow } = await admin.rpc('generate_order_number');
  const orderNumber = orderNumberRow as unknown as string;
  const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_id: profile.customer_id,
      status: 'pending',
      requested_date,
      total_amount: total,
      memo: memo || null,
    })
    .select()
    .single();

  if (orderErr || !order) {
    return apiError('internal', '주문 저장에 실패했습니다', orderErr?.message);
  }

  // 주문 상세 인서트
  const orderItems = items.map((it) => ({
    order_id: order.id,
    product_id: it.product_id,
    quantity: it.quantity,
    unit_price: it.unit_price,
    subtotal: it.quantity * it.unit_price,
  }));
  await admin.from('order_items').insert(orderItems);

  // 거래처 + 관리자 정보 조회 후 알림 발송
  const { data: customer } = await admin
    .from('customers').select('company_name').eq('id', profile.customer_id).single();
  const { data: admins } = await admin
    .from('user_profiles').select('id, role').in('role', ['super_admin', 'admin']);

  if (admins?.length) {
    // 첫 관리자 한 명에게만 발송 (다중 발송은 다음 이터레이션)
    for (const adminUser of admins) {
      const { data: { user: adminAuthUser } } = await admin.auth.admin.getUserById(adminUser.id);
      if (adminAuthUser?.email) {
        await dispatchNotification({
          event: 'order_created',
          to: { email: adminAuthUser.email },
          variables: {
            company_name: customer?.company_name ?? '-',
            order_number: orderNumber,
            item_summary: `${items.length}개 품목`,
            requested_date,
            total_amount: total,
          },
        });
      }
    }
  }

  return NextResponse.json({ order_number: orderNumber, id: order.id });
}

// ─── GET: 주문 조회 (RLS 가 본인 권한만 필터링) ─────────────────────────
export async function GET() {
  if (isDevMode) {
    return NextResponse.json([], { status: 200 });
  }

  const supabase = createClient();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name)), customers(company_name)')
    .order('created_at', { ascending: false });

  if (error) {
    return apiError('internal', '주문 조회 중 오류가 발생했습니다', error.message);
  }

  return NextResponse.json(orders);
}
