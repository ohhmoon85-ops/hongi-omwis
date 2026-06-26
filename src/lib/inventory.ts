// ============================================================================
// 재고 데이터 레이어 — 입고 lot, 입출고 이력, 안전재고 (브라우저 클라이언트, RLS)
// 쓰기는 admin_all_* 정책으로 보호. inventory_logs.created_by = 현재 사용자.
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';

export interface InventoryLot {
  id: string;
  product_id: string;
  product_name: string;
  unit: string;
  lot_number: string | null;
  location: string | null;
  quantity: number;
  initial_quantity: number | null;
  import_date: string | null;
  expiry_date: string | null;
  status: 'active' | 'reserved' | 'depleted';
}

export interface StockSummary {
  product_id: string;
  product_name: string;
  unit: string;
  total: number;          // 활성 lot 수량 합계
  minQuantity: number | null;
  isLow: boolean;
  lotCount: number;
}

export interface InventoryLog {
  id: string;
  product_name: string;
  log_type: 'in' | 'out' | 'adjust';
  quantity: number;
  memo: string | null;
  created_at: string;
}

export async function fetchProducts(): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products').select('*').eq('is_active', true).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

export async function fetchInventory(): Promise<InventoryLot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory')
    .select('*, products(name, unit)')
    .order('import_date', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    product_id: r.product_id,
    product_name: r.products?.name ?? '-',
    unit: r.products?.unit ?? 'kg',
    lot_number: r.lot_number,
    location: r.location,
    quantity: Number(r.quantity),
    initial_quantity: r.initial_quantity != null ? Number(r.initial_quantity) : null,
    import_date: r.import_date,
    expiry_date: r.expiry_date,
    status: r.status,
  }));
}

export async function fetchSafetyMap(): Promise<Map<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('safety_stock').select('product_id, min_quantity');
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const s of data ?? []) map.set(s.product_id, Number(s.min_quantity));
  return map;
}

export async function fetchInventoryLogs(limit = 20): Promise<InventoryLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inventory_logs')
    .select('id, log_type, quantity, memo, created_at, products(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    product_name: r.products?.name ?? '-',
    log_type: r.log_type,
    quantity: Number(r.quantity),
    memo: r.memo,
    created_at: r.created_at,
  }));
}

// 품목별 재고 요약 — 활성 lot 합계 vs 안전재고
export function buildStockSummary(
  products: Product[],
  lots: InventoryLot[],
  safetyMap: Map<string, number>,
): StockSummary[] {
  return products.map((p) => {
    const productLots = lots.filter((l) => l.product_id === p.id && l.status === 'active');
    const total = productLots.reduce((s, l) => s + l.quantity, 0);
    const minQuantity = safetyMap.get(p.id) ?? null;
    return {
      product_id: p.id,
      product_name: p.name,
      unit: p.unit,
      total,
      minQuantity,
      isLow: minQuantity != null && total < minQuantity,
      lotCount: productLots.length,
    };
  });
}

async function currentUserId(): Promise<string | undefined> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

// 입고 — 신규 lot 생성 + 이력(in)
export async function addInbound(params: {
  product_id: string;
  quantity: number;
  lot_number?: string;
  location?: string;
  import_date?: string;
  expiry_date?: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: lot, error } = await supabase
    .from('inventory')
    .insert({
      product_id: params.product_id,
      quantity: params.quantity,
      initial_quantity: params.quantity,
      lot_number: params.lot_number || null,
      location: params.location || null,
      import_date: params.import_date || null,
      expiry_date: params.expiry_date || null,
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await supabase.from('inventory_logs').insert({
    inventory_id: lot.id,
    product_id: params.product_id,
    log_type: 'in',
    quantity: params.quantity,
    input_method: 'manual',
    memo: params.lot_number ? `입고 lot ${params.lot_number}` : '입고',
    created_by: await currentUserId(),
  });
}

// 재고 조정 — lot 수량 보정 + 이력(adjust). 0 이면 소진 처리
export async function adjustLot(
  lot: InventoryLot,
  newQuantity: number,
  memo: string,
): Promise<void> {
  const supabase = createClient();
  const diff = newQuantity - lot.quantity;
  const { error } = await supabase
    .from('inventory')
    .update({
      quantity: newQuantity,
      status: newQuantity <= 0 ? 'depleted' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', lot.id);
  if (error) throw new Error(error.message);

  await supabase.from('inventory_logs').insert({
    inventory_id: lot.id,
    product_id: lot.product_id,
    log_type: 'adjust',
    quantity: diff,
    input_method: 'manual',
    memo: memo || `재고 조정 (${lot.quantity} → ${newQuantity})`,
    created_by: await currentUserId(),
  });
}

// 안전재고 설정 (upsert)
export async function setSafetyStock(productId: string, minQuantity: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('safety_stock')
    .upsert({ product_id: productId, min_quantity: minQuantity }, { onConflict: 'product_id' });
  if (error) throw new Error(error.message);
}
