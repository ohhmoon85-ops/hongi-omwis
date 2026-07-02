// ============================================================================
// 운영 모드 검수 데이터 레이어 — Supabase 브라우저 클라이언트 (RLS)
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import type { Inspection } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Inspection {
  return {
    id: row.id,
    inventory_id: row.inventory_id ?? null,
    product_id: row.product_id,
    product_name: row.products?.name ?? undefined,
    lot_number: row.lot_number,
    supplier: row.supplier ?? null,
    coil_count: row.coil_count ?? null,
    inspector: row.inspector ?? null,
    inspected_at: row.inspected_at,
    thickness_points: row.thickness_points ?? null,
    thickness_tol: Number(row.thickness_tol ?? 0.005),
    width_measured: row.width_measured != null ? Number(row.width_measured) : null,
    weight_measured: row.weight_measured != null ? Number(row.weight_measured) : null,
    mill_checks: row.mill_checks ?? [],
    look_checks: row.look_checks ?? [],
    photo_urls: row.photo_urls ?? [],
    memo: row.memo ?? null,
    verdict: row.verdict,
    created_at: row.created_at,
  };
}

const INSPECTION_SELECT =
  '*, products(name, type, thickness, width)';

export async function fetchInspections(): Promise<Inspection[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .order('inspected_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function fetchInspection(id: string): Promise<Inspection | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

// 이 검수로부터 파생된 반품 이력 (여러 건 가능)
export async function fetchInspectionReturns(inspectionId: string): Promise<Array<{
  id: string;
  order_number: string;
  reason: string;
  restock: boolean;
  return_date: string;
  customer_name: string | null;
}>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('returns')
    .select('id, reason, restock, return_date, orders(order_number, customers(company_name))')
    .eq('inspection_id', inspectionId)
    .order('return_date', { ascending: false });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    order_number: r.orders?.order_number ?? '-',
    reason: r.reason,
    restock: r.restock,
    return_date: r.return_date,
    customer_name: r.orders?.customers?.company_name ?? null,
  }));
}
