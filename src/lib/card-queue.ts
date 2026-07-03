// ============================================================================
// 명함 오프라인 업로드 큐 — IndexedDB
// ----------------------------------------------------------------------------
// 핵심 원칙(②): 현장에서 찍으면 네트워크와 무관하게 "무조건 로컬 먼저" 저장.
// 네트워크가 되면 백그라운드로 하나씩 업로드하고, 성공하면 큐에서 제거한다.
// localStorage 는 이미지(수백 KB)에 용량이 부족 → 반드시 IndexedDB 사용.
// 브라우저 전용.
// ============================================================================

const DB_NAME = 'omwis-cards';
const STORE = 'pending';
const DB_VERSION = 1;

export interface PendingCard {
  id: string;
  blob: Blob;              // 리사이즈된 JPEG
  event_name: string | null;
  quick_memo: string | null;
  captured_at: string;
  tries: number;           // 업로드 재시도 횟수
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 오프라인 저장을 지원하지 않습니다'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 열기 실패'));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 작업 실패'));
    t.oncomplete = () => db.close();
  });
}

/** 촬영 즉시 큐에 저장 */
export async function enqueueCard(card: PendingCard): Promise<void> {
  await tx('readwrite', (s) => s.put(card));
}

/** 대기 중(미업로드) 명함 전체 */
export async function listPending(): Promise<PendingCard[]> {
  const all = await tx<PendingCard[]>('readonly', (s) => s.getAll() as IDBRequest<PendingCard[]>);
  return (all ?? []).sort((a, b) => a.captured_at.localeCompare(b.captured_at));
}

/** 대기 건수 (배지 표시용) */
export async function countPending(): Promise<number> {
  try {
    return await tx<number>('readonly', (s) => s.count());
  } catch {
    return 0;
  }
}

/** 업로드 성공 → 큐에서 제거 */
export async function removePending(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

/** 재시도 횟수 갱신 (지수 백오프 판단용) */
export async function bumpTries(card: PendingCard): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...card, tries: card.tries + 1 }));
}
