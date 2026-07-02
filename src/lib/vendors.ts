// ============================================================================
// 후보 업체(candidate_vendors) 데이터 레이어 — Supabase 브라우저 클라이언트
// admin_all_candidate_vendors 정책으로 super_admin/admin 만 쓰기 가능.
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import type { CandidateVendor, VendorStatus } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): CandidateVendor {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? null,
    contact_name: row.contact_name ?? null,
    wechat: row.wechat ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    price_note: row.price_note ?? null,
    moq: row.moq ?? null,
    lead_time: row.lead_time ?? null,
    payment_terms: row.payment_terms ?? null,
    factory_note: row.factory_note ?? null,
    status: row.status as VendorStatus,
    approved_at: row.approved_at ?? null,
    memo: row.memo ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchCandidateVendors(): Promise<CandidateVendor[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('candidate_vendors').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function fetchCandidateVendor(id: string): Promise<CandidateVendor | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('candidate_vendors').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export interface NewCandidateVendor {
  name: string;
  location?: string;
  contact_name?: string;
  wechat?: string;
  phone?: string;
  email?: string;
  price_note?: string;
  moq?: string;
  lead_time?: string;
  payment_terms?: string;
  factory_note?: string;
}

export async function createCandidateVendor(v: NewCandidateVendor): Promise<CandidateVendor> {
  const res = await fetch('/api/vendors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v),
  });
  if (!res.ok) {
    const { readApiError } = await import('@/lib/api-error');
    throw new Error(await readApiError(res));
  }
  return await res.json();
}

export async function updateCandidateVendor(
  id: string, patch: Partial<NewCandidateVendor & { memo?: string }>,
): Promise<void> {
  const res = await fetch(`/api/vendors?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const { readApiError } = await import('@/lib/api-error');
    throw new Error(await readApiError(res));
  }
}

export async function promoteVendor(id: string, memo?: string): Promise<void> {
  const res = await fetch('/api/vendors/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'approve', memo }),
  });
  if (!res.ok) {
    const { readApiError } = await import('@/lib/api-error');
    throw new Error(await readApiError(res));
  }
}

export async function rejectVendor(id: string, memo?: string): Promise<void> {
  const res = await fetch('/api/vendors/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'reject', memo }),
  });
  if (!res.ok) {
    const { readApiError } = await import('@/lib/api-error');
    throw new Error(await readApiError(res));
  }
}
