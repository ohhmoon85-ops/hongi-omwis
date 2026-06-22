'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { getDevCustomer } from '@/lib/dev-customers';
import { loadDevOrders } from '@/lib/dev-orders';
import { isDevMode } from '@/lib/dev-data';
import { CustomerForm } from './CustomerForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKRW, formatDate } from '@/lib/utils';
import { ORDER_STATUS_BADGE } from '@/types';
import type { Customer } from '@/types';

interface Props { customerId: string }

export function CustomerDetail({ customerId }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isDevMode) {
      const c = getDevCustomer(customerId);
      setCustomer(c ?? null);
    }
    setLoaded(true);
  }, [customerId]);

  if (!loaded) return <div className="text-sm text-gray-500">불러오는 중...</div>;
  if (!customer) {
    return (
      <Card className="bg-[#171b26] border-[#1f2433] max-w-3xl">
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
          <div className="text-sm text-gray-400">존재하지 않는 거래처입니다.</div>
          <Link
            href="/admin/customers"
            className="text-xs text-[#c8962e] hover:underline mt-3 inline-block"
          >
            ← 거래처 목록
          </Link>
        </CardContent>
      </Card>
    );
  }

  // 이 거래처의 주문 이력 (dev-orders 에서 customer_id 매칭)
  const orders = isDevMode
    ? loadDevOrders().filter((o) => o.customer_id === customerId)
    : [];

  return (
    <div className="space-y-6">
      <header className="max-w-5xl">
        <Link
          href="/admin/customers"
          className="text-xs text-gray-400 hover:text-white inline-flex items-center"
        >
          <ChevronLeft className="w-3 h-3" /> 거래처 목록
        </Link>
        <div className="flex flex-wrap items-baseline gap-3 mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{customer.company_name}</h1>
          {!customer.is_active && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">
              비활성 (거래 종료)
            </span>
          )}
          {customer.former_dealer && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {customer.former_dealer} → 본사 직거래 ({formatDate(customer.transferred_at)})
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          등록일: {formatDate(customer.created_at)} · 최종 수정: {formatDate(customer.updated_at)}
        </div>
      </header>

      {/* 주문 이력 요약 */}
      <Card className="bg-[#171b26] border-[#1f2433] text-white max-w-5xl">
        <CardHeader>
          <CardTitle className="text-base text-gray-200">
            주문 이력 ({orders.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-sm text-gray-500">아직 주문 이력이 없습니다.</div>
          ) : (
            <div className="space-y-1.5">
              {orders.slice(0, 8).map((o) => {
                const badge = ORDER_STATUS_BADGE[o.status];
                return (
                  <div key={o.id} className="flex items-center justify-between text-sm py-1 border-b border-[#1f2433] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{o.order_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(o.created_at)} · {o.items.length}품목
                    </div>
                    <div className="text-sm font-semibold text-[#c8962e]">
                      {formatKRW(o.total_amount)}
                    </div>
                  </div>
                );
              })}
              {orders.length > 8 && (
                <div className="text-xs text-gray-500 pt-2 text-center">
                  …외 {orders.length - 8}건 더 있음
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 편집 폼 */}
      <CustomerForm mode="edit" initial={customer} />
    </div>
  );
}
