'use client';

// ============================================================================
// 명함 촬영 화면 — 원칙 ①찍고 끝 ②오프라인 우선
// ----------------------------------------------------------------------------
// · 회사명은 첫 1회만 입력(이후 유지) · 촬영 즉시 저장 · 확인 화면 없음
// · 네트워크와 무관하게 로컬 저장, 되는 대로 백그라운드 업로드(대기 배지)
// · 한 손 촬영: 큰 카메라 버튼(capture="environment")
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { resizeImage } from '@/lib/image-resize';
import { captureCard, flushCardQueue, pendingCount } from '@/lib/cards';
import { isDevMode } from '@/lib/dev-data';
import toast, { Toaster } from 'react-hot-toast';
import { Camera, Upload, WifiOff, Loader2, CheckCircle2 } from 'lucide-react';

const EVENT_KEY = 'omwis_card_event';

export function CardCapture() {
  const [eventName, setEventName] = useState('');
  const [memo, setMemo] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEventName(localStorage.getItem(EVENT_KEY) ?? '');
    setOnline(navigator.onLine);
    refreshPending();
    void flush(); // 진입 시 밀린 업로드 처리

    const goOnline = () => { setOnline(true); void flush(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshPending() {
    setPending(await pendingCount());
  }

  async function flush() {
    if (isDevMode) return;
    const { remaining } = await flushCardQueue();
    setPending(remaining);
  }

  function onEventChange(v: string) {
    setEventName(v);
    localStorage.setItem(EVENT_KEY, v);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await handleShot(file);
    if (inputRef.current) inputRef.current.value = ''; // 즉시 다음 촬영 가능
  }

  async function handleShot(file: Blob) {
    setBusy(true);
    try {
      const resized = await resizeImage(file);
      await captureCard({
        blob: resized.blob,
        dataUrl: resized.dataUrl,
        event_name: eventName.trim() || null,
        quick_memo: memo.trim() || null,
        captured_at: new Date().toISOString(),
      });
      setSavedCount((n) => n + 1);
      setMemo('');
      toast.success(`${savedCount + 1}장째 저장됨`, { duration: 1200 });
      await refreshPending();
      void flush(); // 백그라운드 업로드
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Toaster position="top-center" />

      {/* 행사명 (첫 1회 입력, 이후 유지) */}
      <label className="block text-[11px] text-gray-400 mb-1">수집 행사 (선택 · 자동 유지)</label>
      <input
        value={eventName}
        onChange={(e) => onEventChange(e.target.value)}
        placeholder="예: 상하이 알루미늄展 2026"
        className="w-full h-11 px-3 rounded-lg border border-[#2a2f3e] bg-[#0f1117] text-white text-sm mb-4"
      />

      {/* 대형 카메라 버튼 */}
      <label
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer select-none transition-colors ${
          busy ? 'border-[#c8962e]/40 bg-[#c8962e]/5' : 'border-[#c8962e]/50 bg-gradient-to-b from-[#181c28] to-[#13161f] hover:from-[#1c2130]'
        }`}
        style={{ height: '46vh', minHeight: 260 }}
      >
        {busy ? (
          <Loader2 className="w-14 h-14 text-[#e0bf70] animate-spin" />
        ) : (
          <Camera className="w-16 h-16 text-[#e0bf70]" />
        )}
        <div className="text-lg font-bold text-white">{busy ? '저장 중…' : '명함 촬영'}</div>
        <div className="text-xs text-gray-400">탭하면 카메라 → 찍으면 바로 저장</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          disabled={busy}
          className="hidden"
        />
      </label>

      {/* 한 줄 메모 (다음 촬영에 적용, 저장 후 비움) */}
      <input
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="현장 메모(선택) — 예: 부스 크고 응대 좋음"
        className="w-full h-11 px-3 rounded-lg border border-[#2a2f3e] bg-[#0f1117] text-white text-sm mt-4"
      />

      {/* 상태 바: 오늘 수집 / 대기 / 오프라인 */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <div className="flex items-center gap-1.5 text-gray-300">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          이번 세션 <b className="text-white">{savedCount}</b>장
        </div>
        {!isDevMode && pending > 0 && (
          <button onClick={flush} className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200">
            <Upload className="w-4 h-4" /> 대기 {pending}장 업로드
          </button>
        )}
        {isDevMode && <span className="text-[11px] text-gray-500">개발 모드 · 로컬 저장</span>}
      </div>

      {!online && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          오프라인 상태입니다. 촬영은 계속 됩니다 — 연결되면 자동 업로드돼요.
        </div>
      )}

      <p className="mt-4 text-[11px] text-gray-500 leading-relaxed">
        ※ 이 화면을 닫지 말고 촬영을 이어가세요. 정리(업체 등록)는 나중에 <b>명함 수집함</b>에서 몰아서 합니다.
      </p>
    </div>
  );
}
