// ============================================================================
// 개발 모드 명함 저장소 — localStorage 기반 (Supabase 미연결)
// 사진은 dataURL 로 그대로 보관(photo_path=dataURL) → dev 에서 미리보기 가능.
// ============================================================================

import type { BusinessCard, BusinessCardStatus, CardOcrResult } from '@/types';

const KEY = 'omwis_dev_cards';

export function loadDevCards(): BusinessCard[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(all: BusinessCard[]) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

export interface NewDevCard {
  dataUrl: string;
  event_name: string | null;
  quick_memo: string | null;
  captured_at?: string;
}

export function createDevCard(input: NewDevCard): BusinessCard {
  const now = new Date().toISOString();
  const card: BusinessCard = {
    id: crypto.randomUUID(),
    photo_path: input.dataUrl,
    photo_url: input.dataUrl,
    event_name: input.event_name,
    quick_memo: input.quick_memo,
    status: 'unprocessed',
    candidate_vendor_id: null,
    ocr_result: null,
    captured_at: input.captured_at ?? now,
    processed_at: null,
    created_at: now,
  };
  const all = loadDevCards();
  all.unshift(card);
  persist(all);
  return card;
}

export function updateDevCard(
  id: string,
  patch: Partial<Pick<BusinessCard, 'status' | 'candidate_vendor_id' | 'quick_memo' | 'event_name' | 'ocr_result' | 'processed_at'>>,
) {
  const all = loadDevCards();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  persist(all);
}

export function setDevCardOcr(id: string, ocr: CardOcrResult) {
  updateDevCard(id, { ocr_result: ocr });
}

export function setDevCardStatus(id: string, status: BusinessCardStatus, vendorId?: string) {
  updateDevCard(id, {
    status,
    candidate_vendor_id: vendorId ?? null,
    processed_at: status === 'processed' ? new Date().toISOString() : null,
  });
}
