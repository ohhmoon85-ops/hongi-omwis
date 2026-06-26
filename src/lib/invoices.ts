// ============================================================================
// 세금계산서 클라이언트 레이어 — 조회(브라우저 RLS) + 발행(API 경유)
// ============================================================================

import { createClient } from '@/lib/supabase/client';

export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'failed' | 'cancelled';

export interface InvoiceInfo {
  id: string;
  order_id: string;
  status: InvoiceStatus;
  nts_confirm_number: string | null;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  is_mock: boolean;
}

// 주문별 발행 상태 조회 → Map<order_id, InvoiceInfo>
export async function fetchInvoiceMap(): Promise<Map<string, InvoiceInfo>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('id, order_id, status, nts_confirm_number, supply_amount, tax_amount, total_amount, is_mock');
  if (error) throw new Error(error.message);
  const map = new Map<string, InvoiceInfo>();
  for (const inv of (data ?? []) as InvoiceInfo[]) map.set(inv.order_id, inv);
  return map;
}

// 세금계산서 발행 (관리자) — service_role API 경유
export async function issueInvoice(orderId: string): Promise<InvoiceInfo> {
  const res = await fetch('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? '세금계산서 발행 실패');
  }
  const data = await res.json();
  return data.invoice as InvoiceInfo;
}
