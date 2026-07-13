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

// 끝의 슬래시 제거 (이중 슬래시 방지)
const ACIS_API_URL = (process.env.ACIS_API_URL ?? '').replace(/\/+$/, '');

// ACIS 웹앱 바로가기 URL (대시보드 버튼용) — API 와 동일 베이스
export const ACIS_APP_URL = ACIS_API_URL;

// ─── ACIS 산식 (ACIS 프론트엔드와 동일) ─────────────────────────────────────
const BASE_SHFE = 25250; // 2026 New Normal 기준 SHFE (CNY/MT)

// New Normal 신호 임계값 — ACIS config/acis-config.js (newNormal.spi / .eri) 와 동일
const SPI_BUY_MAX = 1.02;        // SPI ≤ 1.02 → 매수 후보
const SPI_HOLD_MAX = 1.05;       // SPI > 1.05 → 자제(AVOID)
const ERI_FAVORABLE_MAX = 0.98;  // ERI ≤ 0.98 → 환율 유리(BUY 확정 조건)

// RPCI = (SHFE CNY/MT × CNY/KRW + 해상운임) × (1 + 관세율 + 부대비용율)
function calcRPCI(shfeCny: number, cnyKrw: number, tariff = 0.05, misc = 0.03): number {
  const shipping = 55000; // KRW/MT
  return Math.round((shfeCny * cnyKrw + shipping) * (1 + tariff + misc));
}

function movingAvg(arr: number[], n: number): number {
  const slice = arr.slice(-n);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function ymdToISO(t: string): string {
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
}

// ─── Mock 응답 (Phase 3 이전) ────────────────────────────────────────────────
function mockSignal(): ACISSignalResponse {
  return {
    signal: 'HOLD',
    spi: 1.02,
    eri: 0.99,
    lme_price: 2620,
    shfe_price: 19850,
    cny_krw: 187.4,
    usd_krw: 1382.0,
    rpci: 4520,
    recommendation:
      '가격·환율 모두 기준 근처 — 관망 구간. (Mock 데이터)',
    is_mock: true,
    fetched_at: new Date().toISOString(),
  };
}

// ─── 실제 호출 — ACIS 원천 데이터 API + 동일 산식으로 신호 계산 ───────────────
// ACIS 는 신호 JSON 을 직접 노출하지 않고 /api/aluminum·/api/lme·/api/rates 만
// 제공하므로, RPCI/SPI/ERI/신호를 여기서 ACIS 프론트엔드와 동일하게 산출한다.
interface SeriesPoint { date: string; price: number }
interface RateRow { TIME: string; DATA_VALUE: string }

// ACIS evaluateNewNormal() 의 안내 문구와 동일한 형식 (SPI·ERI 기준)
function buildRecommendation(signal: ACISSignal, spi: number, eri: number): string {
  const p = ((spi - 1) * 100).toFixed(1);
  const f = ((eri - 1) * 100).toFixed(1);
  const pTxt = (Number(p) >= 0 ? '+' : '') + p + '%';
  const fTxt = (Number(f) >= 0 ? '+' : '') + f + '%';
  switch (signal) {
    case 'AVOID':
      return `알루미늄 가격이 뉴 노멀 기준 대비 ${pTxt} 비쌉니다. 추가 상승 압력 — 신규 발주를 자제하세요.`;
    case 'BUY':
      return `가격은 기준 대비 ${pTxt}, 환율도 90일 평균 대비 ${fTxt} 유리합니다. 가격·환율 동시 좋은 절호의 매수 시점.`;
    case 'FX-WAIT':
      return `가격은 좋습니다(기준 대비 ${pTxt})만 환율이 평균 대비 ${fTxt} 불리합니다. 환율 진정될 때까지 대기.`;
    default:
      return `가격이 기준 근처(${pTxt}), 환율도 평균 근처(${fTxt}) — 뚜렷한 우위 없음. 소량 분할 구매 또는 관망.`;
  }
}

async function fetchACISSignal(): Promise<ACISSignalResponse> {
  try {
    const opts = { next: { revalidate: 600 } }; // 10분 캐시
    const [alRes, lmeRes, ratesRes] = await Promise.all([
      fetch(`${ACIS_API_URL}/api/aluminum`, opts),
      fetch(`${ACIS_API_URL}/api/lme`, opts),
      fetch(`${ACIS_API_URL}/api/rates`, opts),
    ]);
    if (!alRes.ok || !lmeRes.ok || !ratesRes.ok) {
      throw new Error(`ACIS endpoints ${alRes.status}/${lmeRes.status}/${ratesRes.status}`);
    }

    const al = ((await alRes.json()).data ?? []) as SeriesPoint[];
    const lme = ((await lmeRes.json()).data ?? []) as SeriesPoint[];
    const rates = (await ratesRes.json()) as {
      cny: RateRow[]; usd: RateRow[]; currentCny?: number; currentUsd?: number;
    };
    if (!al.length || !lme.length || !rates.cny?.length) {
      throw new Error('ACIS empty data');
    }

    const cnySeries = rates.cny
      .map((r) => ({ date: ymdToISO(r.TIME), value: parseFloat(r.DATA_VALUE) }))
      .filter((r) => !Number.isNaN(r.value))
      .sort((a, b) => a.date.localeCompare(b.date));

    const curCny = rates.currentCny ?? cnySeries[cnySeries.length - 1].value;
    const curUsd = rates.currentUsd
      ?? parseFloat(rates.usd[rates.usd.length - 1]?.DATA_VALUE ?? '0');

    const alSorted = [...al].sort((a, b) => a.date.localeCompare(b.date));

    // ACIS evaluateNewNormal() 과 동일: 현재 지표 = 마지막 SHFE·현재 환율 기준
    const curShfe = alSorted[alSorted.length - 1].price;
    const currentRPCI = calcRPCI(curShfe, curCny);
    const baseRpci = calcRPCI(BASE_SHFE, curCny);
    const spi = baseRpci > 0 ? currentRPCI / baseRpci : 1;
    const cnyAvg = movingAvg(cnySeries.map((c) => c.value), 90); // 90일 평균 환율
    const eri = cnyAvg > 0 ? curCny / cnyAvg : 1;

    // 4단계 신호 (New Normal — ACIS config 임계값과 동일)
    let signal: ACISSignal;
    if (spi > SPI_HOLD_MAX) signal = 'AVOID';
    else if (spi <= SPI_BUY_MAX && eri <= ERI_FAVORABLE_MAX) signal = 'BUY';
    else if (spi <= SPI_BUY_MAX && eri > ERI_FAVORABLE_MAX) signal = 'FX-WAIT';
    else signal = 'HOLD';

    return {
      signal,
      spi: Math.round(spi * 1000) / 1000,   // 비율 (예: 0.949)
      eri: Math.round(eri * 1000) / 1000,   // 비율 (예: 1.009)
      lme_price: lme[lme.length - 1].price,
      shfe_price: curShfe,
      cny_krw: curCny,
      usd_krw: curUsd,
      rpci: currentRPCI,
      recommendation: buildRecommendation(signal, spi, eri),
      is_mock: false,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ACIS] signal fetch failed, falling back to mock:', err);
    return { ...mockSignal(), is_mock: true };
  }
}

// ACIS /api/signal 응답 → ACISSignalResponse 매핑 (단일 진실 공급원)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSignalEndpoint(j: any): ACISSignalResponse {
  const sig = ['BUY', 'FX-WAIT', 'HOLD', 'AVOID'].includes(j.signal) ? j.signal : 'UNKNOWN';
  return {
    signal: sig as ACISSignal,
    spi: Number(j.spi) || 0,
    eri: Number(j.eri) || 0,
    lme_price: Number(j.lme_price) || 0,
    shfe_price: Number(j.shfe_price) || 0,
    cny_krw: Number(j.cny_krw) || 0,
    usd_krw: Number(j.usd_krw) || 0,
    rpci: Number(j.rpci) || 0,
    recommendation: typeof j.recommendation === 'string' ? j.recommendation : '',
    is_mock: false,
    fetched_at: typeof j.fetched_at === 'string' ? j.fetched_at : new Date().toISOString(),
  };
}

export async function getACISSignal(): Promise<ACISSignalResponse> {
  if (!ACIS_API_URL) return mockSignal();
  // 1) 단일 진실 공급원 — ACIS 가 계산한 신호를 그대로 사용 (UI 와 항상 일치)
  try {
    const res = await fetch(`${ACIS_API_URL}/api/signal`, { next: { revalidate: 600 } });
    if (res.ok) {
      const j = await res.json();
      if (j && j.signal && !j.error) return mapSignalEndpoint(j);
    }
  } catch (err) {
    console.error('[ACIS] /api/signal 실패 — 원천 데이터로 폴백 계산:', err);
  }
  // 2) 폴백 — /api/signal 미배포·오류 시 동일 산식으로 재계산 (무중단)
  return fetchACISSignal();
}

// ─── ACIS 시계열 데이터 — 차트용 ────────────────────────────────────────────
export interface MarketSeries {
  aluminum: Array<{ date: string; price: number }>;  // SHFE CNY/MT
  lme:      Array<{ date: string; price: number }>;  // LME USD/MT
  cnyKrw:   Array<{ date: string; price: number }>;  // CNY/KRW
  usdKrw:   Array<{ date: string; price: number }>;  // USD/KRW
  // 최근값(스냅샷) — 카드 큰 숫자용
  latest: {
    aluminum: number;
    lme: number;
    cnyKrw: number;
    usdKrw: number;
  };
  // 7일 전 대비 변동률 (%)
  change7d: {
    aluminum: number;
    lme: number;
    cnyKrw: number;
    usdKrw: number;
  };
  is_mock: boolean;
  fetched_at: string;
}

function changePct(series: Array<{ price: number }>, n = 7): number {
  if (series.length < 2) return 0;
  const latest = series[series.length - 1].price;
  const past = series[Math.max(0, series.length - 1 - n)].price;
  if (past === 0) return 0;
  return Math.round(((latest - past) / past) * 1000) / 10;
}

function mockMarketSeries(): MarketSeries {
  // 30일 흉내 — 천천히 변동하는 패턴
  const today = new Date();
  const series = (base: number, vol: number) =>
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      const noise = Math.sin(i / 4) * vol + Math.random() * vol * 0.5;
      return { date: d.toISOString().slice(0, 10), price: Math.round((base + noise) * 100) / 100 };
    });

  const aluminum = series(19850, 200);
  const lme      = series(2620, 30);
  const cnyKrw   = series(187.4, 1.2);
  const usdKrw   = series(1382, 8);

  return {
    aluminum, lme, cnyKrw, usdKrw,
    latest: {
      aluminum: aluminum[aluminum.length - 1].price,
      lme:      lme[lme.length - 1].price,
      cnyKrw:   cnyKrw[cnyKrw.length - 1].price,
      usdKrw:   usdKrw[usdKrw.length - 1].price,
    },
    change7d: {
      aluminum: changePct(aluminum),
      lme:      changePct(lme),
      cnyKrw:   changePct(cnyKrw),
      usdKrw:   changePct(usdKrw),
    },
    is_mock: true,
    fetched_at: new Date().toISOString(),
  };
}

export async function getMarketSeries(): Promise<MarketSeries> {
  if (!ACIS_API_URL) return mockMarketSeries();
  try {
    const opts = { next: { revalidate: 600 } };
    const [alRes, lmeRes, ratesRes] = await Promise.all([
      fetch(`${ACIS_API_URL}/api/aluminum`, opts),
      fetch(`${ACIS_API_URL}/api/lme`, opts),
      fetch(`${ACIS_API_URL}/api/rates`, opts),
    ]);
    if (!alRes.ok || !lmeRes.ok || !ratesRes.ok) {
      throw new Error('ACIS endpoints failed');
    }
    const aluminum = ((await alRes.json()).data ?? []) as SeriesPoint[];
    const lme = ((await lmeRes.json()).data ?? []) as SeriesPoint[];
    const rates = (await ratesRes.json()) as {
      cny: RateRow[]; usd: RateRow[]; currentCny?: number; currentUsd?: number;
    };

    const toSeries = (rows: RateRow[]) => rows
      .map((r) => ({ date: ymdToISO(r.TIME), price: parseFloat(r.DATA_VALUE) }))
      .filter((r) => !Number.isNaN(r.price))
      .sort((a, b) => a.date.localeCompare(b.date));

    const cnyKrw = toSeries(rates.cny);
    const usdKrw = toSeries(rates.usd);

    const aluminumSorted = [...aluminum].sort((a, b) => a.date.localeCompare(b.date));
    const lmeSorted = [...lme].sort((a, b) => a.date.localeCompare(b.date));

    // 최근 30일만 유지 (차트 가독성)
    const last30 = <T,>(arr: T[]) => arr.slice(Math.max(0, arr.length - 30));

    const al30 = last30(aluminumSorted);
    const lme30 = last30(lmeSorted);
    const cny30 = last30(cnyKrw);
    const usd30 = last30(usdKrw);

    return {
      aluminum: al30,
      lme: lme30,
      cnyKrw: cny30,
      usdKrw: usd30,
      latest: {
        aluminum: al30[al30.length - 1]?.price ?? 0,
        lme:      lme30[lme30.length - 1]?.price ?? 0,
        cnyKrw:   rates.currentCny ?? cny30[cny30.length - 1]?.price ?? 0,
        usdKrw:   rates.currentUsd ?? usd30[usd30.length - 1]?.price ?? 0,
      },
      change7d: {
        aluminum: changePct(al30),
        lme:      changePct(lme30),
        cnyKrw:   changePct(cny30),
        usdKrw:   changePct(usd30),
      },
      is_mock: false,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ACIS] market series fetch failed:', err);
    return { ...mockMarketSeries(), is_mock: true };
  }
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
