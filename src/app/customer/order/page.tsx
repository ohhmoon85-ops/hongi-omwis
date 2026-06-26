import Link from 'next/link';
import { OrderForm } from '@/components/customer/OrderForm';
import { LogoutButton } from '@/components/shared/LogoutButton';
import { isDevMode, DEV_PRODUCTS, DEV_CUSTOMER } from '@/lib/dev-data';
import { formatKRW } from '@/lib/utils';
import type { Product, Customer } from '@/types';
import { createClient } from '@/lib/supabase/server';

async function loadOrderContext(): Promise<{ products: Product[]; customer: Customer }> {
  if (isDevMode) {
    return { products: DEV_PRODUCTS, customer: DEV_CUSTOMER };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { data: profile } = await supabase
    .from('user_profiles').select('customer_id').eq('id', user.id).single();

  const [{ data: products }, { data: customer }] = await Promise.all([
    supabase.from('products').select('*').eq('is_active', true).order('name'),
    profile?.customer_id
      ? supabase.from('customers').select('*').eq('id', profile.customer_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!customer) throw new Error('customer not found');
  return { products: (products ?? []) as Product[], customer: customer as Customer };
}

export default async function CustomerOrderPage() {
  const { products, customer } = await loadOrderContext();

  return (
    <div className="min-h-screen bg-app-light p-4 sm:p-6 text-[#1c1c1c]">
      <header className="mb-6 max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm text-[#1a3d6b] font-semibold">OMWIS · 거래처 주문</div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">주문하기</h1>
            <div className="mt-2 space-y-1">
              <div className="text-sm">
                <span className="font-semibold text-gray-800">{customer.company_name}</span>
                {customer.former_dealer && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({customer.former_dealer} → 본사 직거래)
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                <span>신용 한도 <b>{formatKRW(customer.credit_limit)}</b></span>
                <span>현재 미수 <b className={customer.current_balance > customer.credit_limit * 0.9 ? 'text-red-600' : ''}>{formatKRW(customer.current_balance)}</b></span>
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Link
              href="/customer/orders"
              className="inline-flex items-center gap-1 px-3 h-10 sm:h-9 rounded-lg bg-white border border-[#1a3d6b]/20 text-[#1a3d6b] hover:bg-[#1a3d6b] hover:text-white transition text-sm whitespace-nowrap"
            >
              주문 내역 →
            </Link>
            <LogoutButton variant="light" showLabel={false} />
          </div>
        </div>
      </header>

      <OrderForm products={products} customerName={customer.company_name} />
    </div>
  );
}
