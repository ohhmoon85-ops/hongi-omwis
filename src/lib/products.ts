// ============================================================================
// 품목(상품) 데이터 레이어 — 기본 단가·활성 관리 (브라우저 클라이언트, RLS)
// products 는 admin_all_products 정책으로 super_admin/admin 만 쓰기 가능.
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import type { Product, ProductType } from '@/types';

export async function fetchAllProducts(): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

export async function updateProductPrice(id: string, basePrice: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('products').update({ base_price: basePrice }).eq('id', id);
  if (error) throw new Error(error.message);
}

// 품목 전체 항목 수정 (이름·종류·두께·폭·단위·단가)
export async function updateProduct(
  id: string,
  fields: {
    name?: string;
    type?: ProductType;
    base_price?: number;
    unit?: string;
    thickness?: number | null;
    width?: number | null;
  },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('products').update(fields).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('products').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export interface NewProduct {
  name: string;
  type: ProductType;
  base_price: number;
  unit: string;
  thickness?: number | null;
  width?: number | null;
}

export async function addProduct(p: NewProduct): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('products').insert({
    name: p.name,
    type: p.type,
    base_price: p.base_price,
    unit: p.unit || 'kg',
    thickness: p.thickness ?? null,
    width: p.width ?? null,
    is_active: true,
  });
  if (error) throw new Error(error.message);
}
