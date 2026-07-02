// ============================================================================
// 개발 모드 후보 업체 저장소 — localStorage 기반
// Supabase 미연결 환경에서 벤더 평가 전 흐름을 테스트 가능.
// ============================================================================

import type { CandidateVendor, VendorStatus } from '@/types';
import type { NewCandidateVendor } from '@/lib/vendors';

const KEY = 'omwis_dev_vendors';

export function loadDevVendors(): CandidateVendor[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDevVendor(v: CandidateVendor) {
  if (typeof window === 'undefined') return;
  const all = loadDevVendors();
  const idx = all.findIndex((x) => x.id === v.id);
  if (idx >= 0) all[idx] = v;
  else           all.unshift(v);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function createDevVendor(input: NewCandidateVendor): CandidateVendor {
  const now = new Date().toISOString();
  const vendor: CandidateVendor = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    location: input.location?.trim() || null,
    contact_name: input.contact_name?.trim() || null,
    wechat: input.wechat?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    price_note: input.price_note?.trim() || null,
    moq: input.moq?.trim() || null,
    lead_time: input.lead_time?.trim() || null,
    payment_terms: input.payment_terms?.trim() || null,
    factory_note: input.factory_note?.trim() || null,
    status: 'evaluating',
    approved_at: null,
    memo: null,
    created_at: now,
    updated_at: now,
  };
  saveDevVendor(vendor);
  return vendor;
}

export function getDevVendor(id: string): CandidateVendor | null {
  return loadDevVendors().find((v) => v.id === id) ?? null;
}

export function updateDevVendorStatus(id: string, status: VendorStatus, memo?: string) {
  const all = loadDevVendors();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    status,
    approved_at: status === 'approved' ? new Date().toISOString() : all[idx].approved_at,
    memo: memo ?? all[idx].memo,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function updateDevVendor(id: string, patch: Partial<NewCandidateVendor & { memo?: string }>) {
  const all = loadDevVendors();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    ...Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' ? (v.trim() || null) : v]),
    ),
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(all));
}
