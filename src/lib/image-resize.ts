// ============================================================================
// 이미지 리사이즈 — 명함 촬영 즉시 용량 축소 (중국 현지망 대비)
// ----------------------------------------------------------------------------
// 긴 변 1280px, JPEG 0.7 로 축소해도 명함 텍스트/필체 판독에는 충분.
// 원본(수 MB)을 그대로 올리면 느린 회선에서 업로드가 막히므로 반드시 축소.
// 브라우저 전용 (canvas 사용).
// ============================================================================

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.7;

export interface ResizedImage {
  blob: Blob;        // 업로드용 (JPEG)
  dataUrl: string;   // 미리보기·오프라인 저장용
  width: number;
  height: number;
}

/** File/Blob → 긴 변 1280px JPEG 로 축소. 실패 시 예외. */
export async function resizeImage(file: Blob): Promise<ResizedImage> {
  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 사용할 수 없습니다');
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('이미지 변환에 실패했습니다');

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { blob, dataUrl, width, height };
}

function fitWithin(w: number, h: number, maxEdge: number) {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap 이 가장 빠르지만 일부 브라우저 미지원 → <img> 폴백
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* 폴백으로 진행 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
