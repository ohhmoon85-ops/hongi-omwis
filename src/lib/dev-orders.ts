// ============================================================================
// 개발 모드 주문 저장소 — localStorage 기반 (브라우저 클라이언트 전용)
// Supabase 미연결 환경에서 Phase 2 흐름을 끝까지 테스트할 수 있도록 제공
// ============================================================================

import type { Order, OrderStatus } from '@/types';

const KEY = 'omwis_dev_orders';

export interface DevOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface DevOrder extends Omit<Order, 'rejection_reason' | 'paid_amount' | 'confirmed_date'> {
  customer_name: string;
  items: DevOrderItem[];
  rejection_reason?: string | null;
  confirmed_date?: string | null;
  paid_amount?: number;
}

export function loadDevOrders(): DevOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDevOrder(order: DevOrder) {
  if (typeof window === 'undefined') return;
  const all = loadDevOrders();
  all.unshift(order);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function updateDevOrderStatus(
  orderId: string,
  status: OrderStatus,
  patch?: Partial<DevOrder>,
) {
  if (typeof window === 'undefined') return;
  const all = loadDevOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    ...patch,
    status,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function generateDevOrderNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const existing = loadDevOrders().filter((o) =>
    o.order_number.includes(today),
  );
  const seq = String(existing.length + 1).padStart(3, '0');
  return `ORD-${today}-${seq}`;
}
