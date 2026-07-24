// ============================================================================
// 개발 모드 검수 저장소 — localStorage 기반
// Supabase 미연결 환경에서 IQC 전 흐름을 테스트할 수 있도록 제공.
// PASS 시 dev-inventory(간이 mock)에도 lot 을 함께 추가한다.
// vendor_sample 검수는 재고 미등록, 상용 조건 스냅샷만 보존.
// ============================================================================

import type { Inspection, IqcSkuPreset } from '@/types';
import { presetToProductName } from '@/lib/iqc-presets';

const INSPECTION_KEY = 'omwis_dev_inspections';
const INVENTORY_KEY  = 'omwis_dev_inventory';

// ─── Inspections ────────────────────────────────────────────────────────────
export function loadDevInspections(): Inspection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INSPECTION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDevInspection(insp: Inspection) {
  if (typeof window === 'undefined') return;
  const all = loadDevInspections();
  all.unshift(insp);
  localStorage.setItem(INSPECTION_KEY, JSON.stringify(all));
}

export function getDevInspection(id: string): Inspection | null {
  return loadDevInspections().find((i) => i.id === id) ?? null;
}

// ─── Inventory (mock — IQC PASS 로 등록된 lot 만 저장) ───────────────────────
export interface DevInventoryLot {
  id: string;
  product_id: string;
  product_name: string;
  lot_number: string;
  quantity: number;      // kg
  supplier: string | null;
  inspection_id: string; // 이 검수로 만들어진 lot
  import_date: string;
  created_at: string;
}

export function loadDevInventory(): DevInventoryLot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDevInventoryLot(lot: DevInventoryLot) {
  if (typeof window === 'undefined') return;
  const all = loadDevInventory();
  all.unshift(lot);
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(all));
}

// dev 검수→재고 등록 편의 함수: 검수 결과 PASS 를 재고 lot 으로 승격
export function registerInventoryFromInspection(
  insp: Inspection,
  preset: IqcSkuPreset,
  quantity: number,
): DevInventoryLot {
  const lot: DevInventoryLot = {
    id: crypto.randomUUID(),
    product_id: insp.product_id,
    product_name: presetToProductName(preset),
    lot_number: insp.lot_number,
    quantity,
    supplier: insp.supplier,
    inspection_id: insp.id,
    import_date: insp.inspected_at,
    created_at: new Date().toISOString(),
  };
  saveDevInventoryLot(lot);

  // Inspection 에 inventory_id 역참조 반영
  const all = loadDevInspections();
  const idx = all.findIndex((i) => i.id === insp.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], inventory_id: lot.id };
    localStorage.setItem(INSPECTION_KEY, JSON.stringify(all));
  }
  return lot;
}
