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
