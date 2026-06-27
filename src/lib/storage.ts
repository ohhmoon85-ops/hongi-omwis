// ============================================================================
// Supabase Storage 헬퍼 — 수입신고필증 첨부 파일 처리
// ----------------------------------------------------------------------------
// 사전 조건 (사용자 1회 셋업):
//   1) Supabase Dashboard → Storage → New bucket → 'customs-docs' (Private)
//   2) Policies → 'authenticated' 가 INSERT/SELECT 가능 (admin RLS 는 별도)
//
// 2026-06-27: 배송 모델 단순화로 delivery-photos 업로드 헬퍼는 제거.
//   버킷 자체는 Supabase 에 남아 있어 향후 자체 배송 도입 시 재사용 가능.
// ============================================================================

import { createClient } from '@/lib/supabase/client';

export const CUSTOMS_DOCS_BUCKET = 'customs-docs';

export interface UploadResult {
  path: string;        // 버킷 내 경로 (예: 2026/03/abc.jpg)
  publicUrl?: string;  // bucket public 인 경우만
  signedUrl?: string;  // private 인 경우 임시 URL (1시간)
}

function makePath(filename: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin';
  const safe = crypto.randomUUID();
  return `${yyyy}/${mm}/${safe}.${ext}`;
}

/** 수입신고필증 사진 업로드 — Private bucket + 1 시간 서명 URL 반환 */
export async function uploadCustomsDoc(file: File): Promise<UploadResult> {
  const supabase = createClient();
  const path = makePath(file.name);

  const { error: upErr } = await supabase.storage
    .from(CUSTOMS_DOCS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
  if (upErr) throw new Error(upErr.message);

  // private bucket — 1 시간 서명 URL 발급
  const { data, error: sErr } = await supabase.storage
    .from(CUSTOMS_DOCS_BUCKET)
    .createSignedUrl(path, 3600);
  if (sErr) throw new Error(sErr.message);

  return { path, signedUrl: data?.signedUrl };
}

/** 저장된 path 로 새 서명 URL 발급 (UI 에서 다운로드 시 호출) */
export async function getCustomsDocUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(CUSTOMS_DOCS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) {
    console.error('[storage] signed url failed:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** 파일 삭제 — 입고 취소 등 */
export async function deleteCustomsDoc(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(CUSTOMS_DOCS_BUCKET).remove([path]);
}
