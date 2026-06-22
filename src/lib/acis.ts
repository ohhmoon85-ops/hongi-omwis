// ============================================================================
// ACIS (알루미늄 수입 의사결정 시스템) 연동
// ----------------------------------------------------------------------------
// 현재는 ACIS 측에 REST API 가 노출되어 있지 않으므로 Mock 응답 반환.
// Phase 3 시작 시 ACIS 프로젝트에 /api/signal, /api/inventory-sync 추가 후
// .env.local 의 ACIS_API_URL 만 채우면 자동으로 실제 호출로 전환됩니다.
// ============================================================================

export type ACISSignal = 'BUY' | 'FX-WAIT' | 'HOLD' | 'AVOID' | 'UNKNOWN';

export interface ACISSignalResponse {
  signal: ACISSignal;
  spi: number;          // 수입 가격 지수
  eri: number;          // 환율 위험 지수
  lme_price: number;    // USD/ton
  shfe_price: number;   // CNY/ton
  cny_krw: number;
  usd_krw: number;
  rpci: number;         // Real Purchase Cost Index
  recommendation: string;
  is_mock: boolean;     // Mock 응답 여부 (UI 에 "데모" 라벨 표시용)
  fetched_at: string;
}

export interface InventoryStatus {
  weeks_on_hand: number;
  threshold: number;
  should_hold: boolean;
}

const ACIS_API_URL = process.env.ACIS_API_URL ?? '';

// ─── Mock 응답 (Phase 3 이전) ────────────────────────────────────────────────
function mockSignal(): ACISSignalResponse {
  return {
    signal: 'HOLD',
    spi: 102.3,
    eri: 0.85,
    lme_price: 2620,
    shfe_price: 19850,
    cny_krw: 187.4,
    usd_krw: 1382.0,
    rpci: 4520,
    recommendation:
      '단기 시황 안정 — 다음 BUY 시점은 RPCI 4,400 이하 진입 시. (Mock 데이터)',
    is_mock: true,
    fetched_at: new Date().toISOString(),
  };
}

// ─── 실제 호출 (Phase 3+) ────────────────────────────────────────────────────
async function fetchACISSignal(): Promise<ACISSignalResponse> {
  try {
    const res = await fetch(`${ACIS_API_URL}/api/signal`, {
      next: { revalidate: 600 }, // 10 분 캐시
    });
    if (!res.ok) throw new Error(`ACIS ${res.status}`);
    const data = await res.json();
    return { ...data, is_mock: false, fetched_at: new Date().toISOString() };
  } catch (err) {
    console.error('[ACIS] signal fetch failed, falling back to mock:', err);
    return { ...mockSignal(), is_mock: true };
  }
}

export async function getACISSignal(): Promise<ACISSignalResponse> {
  if (!ACIS_API_URL) return mockSignal();
  return fetchACISSignal();
}

export async function syncInventoryToACIS(status: InventoryStatus): Promise<void> {
  if (!ACIS_API_URL) {
    console.log('[ACIS MOCK] inventory sync skipped:', status);
    return;
  }
  try {
    await fetch(`${ACIS_API_URL}/api/inventory-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(status),
    });
  } catch (err) {
    console.error('[ACIS] inventory sync failed:', err);
  }
}

// ─── UI 표시용 라벨/색상 ─────────────────────────────────────────────────────
export const ACIS_SIGNAL_BADGE: Record<ACISSignal, { label: string; color: string }> = {
  BUY:       { label: '🟢 BUY',     color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'FX-WAIT': { label: '🟡 FX-WAIT', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  HOLD:      { label: '⚪ HOLD',    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  AVOID:     { label: '🔴 AVOID',   color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  UNKNOWN:   { label: '— UNKNOWN',  color: 'bg-gray-700 text-gray-500 border-gray-700' },
};
