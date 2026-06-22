// ============================================================================
// 개발 모드 거래처 저장소 — localStorage 기반
// Supabase 미연결 환경에서 거래처 관리 흐름을 끝까지 테스트할 수 있도록 제공.
// 최초 호출 시 시드 3개 자동 등록 (대리점 이관 2 + 신규 직거래 1)
// ============================================================================

import type { Customer } from '@/types';

const KEY = 'omwis_dev_customers';

const SEED: Customer[] = [
  {
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
    memo: '대리점 이관 거래처 — 직거래 1호',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'dev-cust-2',
    company_name: '(주)LG PCB',
    contact_name: '박지영',
    phone: '010-3333-4444',
    email: 'park@lgpcb.kr',
    address: '경북 구미시 공단동 200',
    delivery_address: '경북 구미시 공단동 200',
    price_tier: 'gold',
    credit_limit: 80000000,
    current_balance: 12500000,
    is_active: true,
    former_dealer: '대구대리점',
    transferred_at: '2026-02-01T00:00:00Z',
    memo: '대리점 이관 거래처 — 신용 한도 8천만',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'dev-cust-3',
    company_name: '소형부품제작소',
    contact_name: '이상호',
    phone: '010-5555-6666',
    email: 'lee@spm.kr',
    address: '인천 남동구 산단로 50',
    delivery_address: '인천 남동구 산단로 50',
    price_tier: 'standard',
    credit_limit: 10000000,
    current_balance: 0,
    is_active: true,
    former_dealer: null,
    transferred_at: null,
    memo: '신규 직거래 거래처',
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
];

export function loadDevCustomers(): Customer[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(KEY, JSON.stringify(SEED));
    return SEED;
  } catch {
    return SEED;
  }
}

export function saveDevCustomers(customers: Customer[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(customers));
}

export function upsertDevCustomer(c: Customer) {
  const all = loadDevCustomers();
  const idx = all.findIndex((x) => x.id === c.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    all[idx] = { ...c, updated_at: now };
  } else {
    all.unshift({ ...c, updated_at: now, created_at: now });
  }
  saveDevCustomers(all);
}

export function getDevCustomer(id: string): Customer | undefined {
  return loadDevCustomers().find((c) => c.id === id);
}

export function deactivateDevCustomer(id: string) {
  const all = loadDevCustomers();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], is_active: false, updated_at: new Date().toISOString() };
  saveDevCustomers(all);
}

export function reactivateDevCustomer(id: string) {
  const all = loadDevCustomers();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], is_active: true, updated_at: new Date().toISOString() };
  saveDevCustomers(all);
}

export const PRICE_TIER_OPTIONS = [
  { value: 'standard', label: 'Standard (기본)' },
  { value: 'silver',   label: 'Silver' },
  { value: 'gold',     label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
];

export function priceTierBadge(tier: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    standard: { label: 'Standard', color: 'bg-gray-200 text-gray-700' },
    silver:   { label: 'Silver',   color: 'bg-slate-300 text-slate-800' },
    gold:     { label: 'Gold',     color: 'bg-amber-100 text-amber-800' },
    platinum: { label: 'Platinum', color: 'bg-purple-100 text-purple-800' },
  };
  return map[tier] ?? map.standard;
}
