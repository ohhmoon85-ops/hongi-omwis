// ============================================================================
// 명함(business_cards) 데이터 레이어
// ----------------------------------------------------------------------------
// 원칙: ① 촬영 = 로컬 큐에 넣고 끝  ② 업로드는 백그라운드  ③ AI 는 선택.
// dev 모드(Supabase 미연결)는 localStorage 에 즉시 저장(사진=dataURL).
// 운영 모드는 IndexedDB 큐 → 업로드 → /api/cards row insert.
// ============================================================================

import { isDevMode } from '@/lib/dev-data';
import { readApiError } from '@/lib/api-error';
import { uploadBusinessCard, getBusinessCardUrls } from '@/lib/storage';
import {
  enqueueCard, listPending, removePending, bumpTries, countPending,
} from '@/lib/card-queue';
import {
  loadDevCards, createDevCard, updateDevCard, setDevCardStatus, setDevCardOcr,
} from '@/lib/dev-cards';
import type { BusinessCard, BusinessCardStatus, CardOcrResult } from '@/types';

export interface CardDraft {
  blob: Blob;
  dataUrl: string;
  event_name: string | null;
  quick_memo: string | null;
  captured_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): BusinessCard {
  return {
    id: row.id,
    photo_path: row.photo_path,
    photo_url: null,
    event_name: row.event_name ?? null,
    quick_memo: row.quick_memo ?? null,
    status: row.status as BusinessCardStatus,
    candidate_vendor_id: row.candidate_vendor_id ?? null,
    ocr_result: (row.ocr_result as CardOcrResult) ?? null,
    captured_at: row.captured_at,
    processed_at: row.processed_at ?? null,
    created_at: row.created_at,
  };
}

// ─── 촬영: 로컬 우선 저장 ────────────────────────────────────────────────────
/** 촬영 1장 저장. 운영=큐에 적재(업로드는 flush 로), dev=즉시 저장. */
export async function captureCard(draft: CardDraft): Promise<'dev' | 'queued'> {
  if (isDevMode) {
    createDevCard({
      dataUrl: draft.dataUrl,
      event_name: draft.event_name,
      quick_memo: draft.quick_memo,
      captured_at: draft.captured_at,
    });
    return 'dev';
  }
  await enqueueCard({
    id: crypto.randomUUID(),
    blob: draft.blob,
    event_name: draft.event_name,
    quick_memo: draft.quick_memo,
    captured_at: draft.captured_at,
    tries: 0,
  });
  return 'queued';
}

/** 대기 큐 건수 (오프라인 배지) */
export async function pendingCount(): Promise<number> {
  if (isDevMode) return 0;
  return countPending();
}

/** 큐에 쌓인 명함을 하나씩 업로드 → row insert. 네트워크 되는 만큼 처리. */
export async function flushCardQueue(): Promise<{ uploaded: number; remaining: number }> {
  if (isDevMode) return { uploaded: 0, remaining: 0 };
  const pend = await listPending();
  let uploaded = 0;
  for (const p of pend) {
    try {
      const { path } = await uploadBusinessCard(p.blob);
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_path: path,
          event_name: p.event_name,
          quick_memo: p.quick_memo,
          captured_at: p.captured_at,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      await removePending(p.id);
      uploaded++;
    } catch {
      await bumpTries(p); // 실패 → 큐에 남겨 다음 flush 때 재시도
    }
  }
  return { uploaded, remaining: await countPending() };
}

// ─── 수집함: 조회 ────────────────────────────────────────────────────────────
export async function fetchCards(status?: BusinessCardStatus): Promise<BusinessCard[]> {
  if (isDevMode) {
    const all = loadDevCards();
    return status ? all.filter((c) => c.status === status) : all;
  }
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`/api/cards${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readApiError(res));
  const rows = (await res.json()) as unknown[];
  const cards = rows.map(mapRow);

  // 사진 서명 URL 일괄 발급
  const paths = cards.map((c) => c.photo_path).filter(Boolean);
  if (paths.length) {
    const urls = await getBusinessCardUrls(paths);
    for (const c of cards) c.photo_url = urls[c.photo_path] ?? null;
  }
  return cards;
}

// ─── 처리: 상태 변경 ─────────────────────────────────────────────────────────
async function patchCard(id: string, patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/cards?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

/** 명함을 업체와 연결하고 처리완료 표시 */
export async function linkCardToVendor(id: string, vendorId: string): Promise<void> {
  if (isDevMode) { setDevCardStatus(id, 'processed', vendorId); return; }
  await patchCard(id, { status: 'processed', candidate_vendor_id: vendorId });
}

/** 명함 버리기 (복구 가능 — 삭제 아님) */
export async function discardCard(id: string): Promise<void> {
  if (isDevMode) { setDevCardStatus(id, 'discarded'); return; }
  await patchCard(id, { status: 'discarded' });
}

/** 버린 명함 되살리기 */
export async function restoreCard(id: string): Promise<void> {
  if (isDevMode) { setDevCardStatus(id, 'unprocessed'); return; }
  await patchCard(id, { status: 'unprocessed', candidate_vendor_id: null });
}

/** 현장 메모 수정 */
export async function updateCardMemo(id: string, quick_memo: string): Promise<void> {
  if (isDevMode) { updateDevCard(id, { quick_memo: quick_memo || null }); return; }
  await patchCard(id, { quick_memo });
}

// ─── AI 인식 (선택) ──────────────────────────────────────────────────────────
/** AI 인식 사용 가능 여부 (서버에 ANTHROPIC_API_KEY 있는지) */
export async function isOcrEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/cards/ocr', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: boolean };
    return !!body.enabled;
  } catch {
    return false;
  }
}

/** 명함 이미지를 AI 로 읽어 필드 추출 (자동 저장 아님 — 사람이 확인 후 등록). */
export async function ocrCard(id: string, imageBase64: string): Promise<CardOcrResult> {
  const res = await fetch('/api/cards/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64, media_type: 'image/jpeg' }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const ocr = (await res.json()) as CardOcrResult;
  if (isDevMode) setDevCardOcr(id, ocr);
  else await patchCard(id, { ocr_result: ocr }).catch(() => { /* 캐시 실패는 무시 */ });
  return ocr;
}
