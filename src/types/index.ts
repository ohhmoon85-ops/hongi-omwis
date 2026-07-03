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
  inspection_id: string | null;  // 원 검수 역추적 (007 마이그레이션)
  created_at: string;
}

// ============================================================================
// IQC (입고 품질검수) — 2026-07-02 Phase 3 착수
// ============================================================================

export type Verdict = 'PASS' | 'FAIL' | 'PENDING';

// 체크리스트 응답: ok=이상 없음 / ng=불량 / null=미확인(정보 부족)
export type CheckResult = 'ok' | 'ng' | null;

export interface ChecklistItem {
  q: string;              // 질문 라벨
  hint?: string;          // 도움말 (성적서 어디 보라 등)
  r: CheckResult;         // 저장된 응답
}

export type InspectionPurpose = 'incoming' | 'vendor_sample';

// 평가 시점 상용 조건 스냅샷 (업체가 나중에 조건 바꿔도 원 값 보존)
export interface CommercialSnapshot {
  price_note?: string;      // "USD 2,450/t"
  moq?: string;             // "5t"
  lead_time?: string;       // "30일"
  payment_terms?: string;   // "T/T 30/70"
}

export interface Inspection {
  id: string;
  inventory_id: string | null;   // PASS 시 만들어진 재고 lot 참조 (incoming 만)
  product_id: string;
  product_name?: string;         // 조인 표시용 (DB 원 컬럼 아님)
  lot_number: string;
  supplier: string | null;
  coil_count: number | null;
  inspector: string | null;
  inspected_at: string;

  thickness_points: (number | null)[] | null;   // 5점 (각 점 null 허용)
  thickness_tol: number;               // ±mm
  width_measured: number | null;
  weight_measured: number | null;

  mill_checks: ChecklistItem[];
  look_checks: ChecklistItem[];

  photo_urls: string[];
  memo: string | null;
  verdict: 'PASS' | 'FAIL';            // DB CHECK 상 PENDING 저장 불가

  // 2026-07-04 vendor evaluation 확장 (008)
  purpose: InspectionPurpose;                          // incoming | vendor_sample
  candidate_vendor_id: string | null;                  // vendor_sample 인 경우 참조
  candidate_vendor_name?: string;                      // 조인 표시용
  commercial_snapshot: CommercialSnapshot | null;      // 평가 시점 조건

  created_at: string;
}

// 후보 업체 상태
export type VendorStatus = 'evaluating' | 'approved' | 'rejected' | 'on_hold';

export interface CandidateVendor {
  id: string;
  name: string;
  location: string | null;
  contact_name: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  price_note: string | null;
  moq: string | null;
  lead_time: string | null;
  payment_terms: string | null;
  factory_note: string | null;
  status: VendorStatus;
  approved_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export const VENDOR_STATUS_BADGE: Record<VendorStatus, { label: string; color: string }> = {
  evaluating: { label: '평가 중',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  approved:   { label: '승격 완료', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  rejected:   { label: '탈락',      color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  on_hold:    { label: '보류',      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};

// ----------------------------------------------------------------------------
// 명함 촬영·수집 (Business Cards) — 현장에서 찍고 끝, 나중에 몰아서 업체로 정리
// ----------------------------------------------------------------------------
export type BusinessCardStatus = 'unprocessed' | 'processed' | 'discarded';

/** AI 명함 인식 결과 (선택 기능) — 모든 필드는 못 읽으면 null */
export interface CardOcrResult {
  company: string | null;
  contact_name: string | null;
  title: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  address: string | null;
}

export interface BusinessCard {
  id: string;
  photo_path: string;          // Storage 경로 (운영) / dataURL (dev)
  photo_url?: string | null;   // 화면 렌더용 서명 URL (조회 시 채움)
  event_name: string | null;
  quick_memo: string | null;
  status: BusinessCardStatus;
  candidate_vendor_id: string | null;
  ocr_result: CardOcrResult | null;
  captured_at: string;
  processed_at: string | null;
  created_at: string;
}

export const CARD_STATUS_BADGE: Record<BusinessCardStatus, { label: string; color: string }> = {
  unprocessed: { label: '미처리',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  processed:   { label: '처리 완료', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  discarded:   { label: '버림',      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

// 품목별 검수 기준
export interface InspectionSpec {
  product_id: string;
  thickness_tol: number;
  width_plus: number;
  width_minus: number;
  weight_tol_pct: number;
  updated_at: string;
}

// SKU 프리셋 — 12종 카탈로그 (검수 화면 SkuSelector 에서 사용)
export interface IqcSkuPreset {
  code: string;               // 임의 코드 (raw-010-540 등)
  type: ProductType;
  thickness: number;          // 기준 두께 mm
  width: number;              // 기준 폭 mm
  purity: string;
  displayName: string;        // 화면 표시용
}

export const VERDICT_BADGE: Record<'PASS' | 'FAIL' | 'PENDING', { label: string; color: string }> = {
  PASS:    { label: '합격',   color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  FAIL:    { label: '불합격', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  PENDING: { label: '미완',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};

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
