// ============================================================================
// OMWIS 전역 타입 정의
// ============================================================================

export type UserRole =
  | 'chairman'      // 회장 — 전사 모니터링 (Read-Only)
  | 'super_admin'   // 변지수 대표
  | 'admin'         // 운영 관리자 (직원 ②)
  | 'driver'        // 배송 담당 (직원 ①)
  | 'customer';     // 거래처

export interface UserProfile {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  customer_id?: string | null;
}

// 주문 상태 5+3 단계
export type OrderStatus =
  | 'pending'      // 승인 대기
  | 'approved'     // 승인 완료
  | 'rejected'     // 거절
  | 'processing'   // 처리 중
  | 'ready'        // 출고 준비
  | 'shipping'     // 배송 중
  | 'delivered'    // 배송 완료
  | 'cancelled';   // 취소

export type ProductType = 'raw' | 'oil' | 'water'; // 생/지용성/수용성

export interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  delivery_address: string | null;
  price_tier: string;
  credit_limit: number;
  current_balance: number;
  is_active: boolean;
  former_dealer: string | null;
  transferred_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  thickness: number | null;
  width: number | null;
  unit: string;
  base_price: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  requested_date: string | null;
  confirmed_date: string | null;
  total_amount: number;
  paid_amount: number;
  memo: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface InventoryRecord {
  id: string;
  product_id: string;
  lot_number: string | null;
  location: string | null;
  quantity: number;
  initial_quantity: number | null;
  import_date: string | null;
  expiry_date: string | null;
  qr_code: string | null;
  customs_doc_url: string | null;
  status: 'active' | 'reserved' | 'depleted';
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_name: string | null;
  driver_phone: string | null;
  status: 'scheduled' | 'departed' | 'delivered' | 'failed';
  scheduled_date: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  completion_photo_url: string | null;
  delivery_address: string | null;
}

// ----------------------------------------------------------------------------
// 화면 표시용 상수
// ----------------------------------------------------------------------------

export const ORDER_STATUS_BADGE: Record<
  OrderStatus,
  { label: string; color: string }
> = {
  pending:    { label: '승인 대기', color: 'bg-gray-100 text-gray-700' },
  approved:   { label: '승인 완료', color: 'bg-blue-100 text-blue-700' },
  processing: { label: '처리 중',   color: 'bg-purple-100 text-purple-700' },
  ready:      { label: '출고 준비', color: 'bg-yellow-100 text-yellow-800' },
  shipping:   { label: '배송 중',   color: 'bg-orange-100 text-orange-700' },
  delivered:  { label: '배송 완료', color: 'bg-green-100 text-green-700' },
  cancelled:  { label: '취소',      color: 'bg-gray-100 text-gray-500' },
  rejected:   { label: '거절',      color: 'bg-red-100 text-red-700' },
};

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  raw:   '생 알루미늄',
  oil:   '지용성',
  water: '수용성',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  chairman:    '회장 (모니터링)',
  super_admin: '슈퍼 관리자',
  admin:       '운영 관리자',
  driver:      '배송 담당',
  customer:    '거래처',
};
