// ============================================================================
// OMWIS 전역 타입 정의
// ----------------------------------------------------------------------------
// 2026-06-27: 배송 모델 단순화 (출고=완료) + driver 역할 제거 + 반품 추가
// ============================================================================

export type UserRole =
  | 'chairman'      // 회장 — 전사 모니터링 (Read-Only)
  | 'super_admin'   // 변지수 대표
  | 'admin'         // 운영 관리자
  | 'customer';     // 거래처 (대리점 4개사)

export interface UserProfile {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  customer_id?: string | null;
}

// 주문 상태 — 4단계 + 3개 종결 상태
//   pending → approved → processing → shipped (출고 = 완료)
//   분기 종결: cancelled / rejected / returned
export type OrderStatus =
  | 'pending'      // 승인 대기
  | 'approved'     // 승인 완료
  | 'processing'   // 처리 중 (생산·출고 준비)
  | 'shipped'      // 출고 완료 (= 끝)
  | 'cancelled'    // 취소
  | 'rejected'     // 거절
  | 'returned';    // 반품 (출고 후 하자 등)

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
  former_dealer: string | null;          // 이관된 대리점명 (히스토리 보존)
  transferred_at: string | null;
  business_number?: string | null;       // 사업자등록번호 (세금계산서용)
  ceo_name?: string | null;              // 대표자
  biz_type?: string | null;              // 업태
  biz_item?: string | null;              // 종목
  tax_email?: string | null;             // 세금계산서 수신 이메일
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  thickness: number | null;   // 사이즈 (mm)
  width: number | null;
  purity?: string | null;     // 순도 (예: '99.3% 합금', '99.99% 순알')
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

export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'failed' | 'cancelled';

export interface Invoice {
  id: string;
  order_id: string;
  customer_id: string;
  mgt_key: string;
  nts_confirm_number: string | null;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  issue_date: string | null;
  is_mock: boolean;
  pdf_url: string | null;
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

// 반품 이력 — 출고(shipped) 후 하자/이상 발생 시 기록
export interface ReturnRecord {
  id: string;
  order_id: string;
  reason: string;
  restock: boolean;          // true = 정상품, 재고 복원 / false = 폐기
  return_date: string;
  memo: string | null;
  created_at: string;
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
  shipped:    { label: '출고 완료', color: 'bg-green-100 text-green-700' },
  cancelled:  { label: '취소',      color: 'bg-gray-100 text-gray-500' },
  rejected:   { label: '거절',      color: 'bg-red-100 text-red-700' },
  returned:   { label: '반품',      color: 'bg-orange-100 text-orange-700' },
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
  customer:    '거래처',
};
