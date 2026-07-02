// ============================================================================
// inspection_specs — 품목별 검수 기준 (관리자 조정)
// ----------------------------------------------------------------------------
// 검수 화면에서 target ± tol / width +plus/-minus 를 이 테이블에서 조회.
// 미설정 시 코드 상수 (DEFAULT_*) 로 폴백.
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import type { InspectionSpec } from '@/types';

export const DEFAULT_SPEC = {
  thickness_tol: 0.005,
  width_plus: 1.0,
  width_minus: 0.0,
  weight_tol_pct: 0.5,
};

export async function fetchAllInspectionSpecs(): Promise<Map<string, InspectionSpec>> {
  const supabase = createClient();
  const { data, error } = await supabase.from('inspection_specs').select('*');
  if (error) throw new Error(error.message);
  const m = new Map<string, InspectionSpec>();
  for (const s of data ?? []) {
    m.set(s.product_id, {
      product_id: s.product_id,
      thickness_tol: Number(s.thickness_tol),
      width_plus: Number(s.width_plus),
      width_minus: Number(s.width_minus),
      weight_tol_pct: Number(s.weight_tol_pct),
      updated_at: s.updated_at,
    });
  }
  return m;
}

export async function fetchInspectionSpec(productId: string): Promise<InspectionSpec | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inspection_specs').select('*').eq('product_id', productId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    product_id: data.product_id,
    thickness_tol: Number(data.thickness_tol),
    width_plus: Number(data.width_plus),
    width_minus: Number(data.width_minus),
    weight_tol_pct: Number(data.weight_tol_pct),
    updated_at: data.updated_at,
  };
}

export async function upsertInspectionSpec(
  productId: string,
  fields: Partial<Omit<InspectionSpec, 'product_id' | 'updated_at'>>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('inspection_specs')
    .upsert({
      product_id: productId,
      ...fields,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' });
  if (error) throw new Error(error.message);
}
