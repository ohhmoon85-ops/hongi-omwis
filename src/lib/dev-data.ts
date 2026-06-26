// ============================================================================
// 개발 모드 (Supabase 미연결) 용 하드코딩 데이터
// 실제 운영에서는 사용되지 않음 — Supabase 가 연결되면 자동으로 비활성
// ============================================================================

import type { Customer, Product } from '@/types';

// isDevMode 는 lib/env 에 단일 정의 — 여기는 호환용 재export
export { isDevMode } from './env';

export const DEV_PRODUCTS: Product[] = [
  {
    id: 'dev-prod-1', name: '생 알루미늄 0.5mm × 1000mm',
    type: 'raw', thickness: 0.5, width: 1000, unit: 'kg',
    base_price: 4500, is_active: true, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dev-prod-2', name: '지용성 코팅 0.3mm × 800mm',
    type: 'oil', thickness: 0.3, width: 800, unit: 'kg',
    base_price: 5200, is_active: true, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dev-prod-3', name: '수용성 코팅 0.3mm × 800mm',
    type: 'water', thickness: 0.3, width: 800, unit: 'kg',
    base_price: 5400, is_active: true, created_at: '2026-01-01T00:00:00Z',
  },
];

// 거래처 화면에서 로그인할 때 사용할 기본 거래처 (dev-customers 의 시드 첫번째와 일치)
export const DEV_CUSTOMER: Customer = {
  id: 'dev-cust-1',
  company_name: '(주)삼성회로기판',
  contact_name: '김민수',
  phone: '010-1111-2222',
  email: 'kim@samscb.kr',
  address: '경기 수원시 영통구 광교로 100',
  delivery_address: '경기 수원시 영통구 광교로 100',
  price_tier: 'gold',
  credit_limit: 50000000,
  current_balance: 3200000,
  is_active: true,
  former_dealer: '서울대리점',
  transferred_at: '2026-01-15T00:00:00Z',
  memo: null,
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
};
