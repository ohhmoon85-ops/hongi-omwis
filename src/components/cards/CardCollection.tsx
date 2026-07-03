'use client';

// ============================================================================
// 명함 수집함 — 배치 처리
// · 상태 필터(미처리/처리완료/버림) · 썸네일 그리드
// · 명함 클릭 → 처리 화면(CardProcess), 처리 후 다음 미처리로 자동 이동
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCards, isOcrEnabled } from '@/lib/cards';
import { CARD_STATUS_BADGE, type BusinessCard, type BusinessCardStatus } from '@/types';
import { CardProcess } from './CardProcess';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Camera, ChevronLeft } from 'lucide-react';

const TABS: { key: BusinessCardStatus; label: string }[] = [
  { key: 'unprocessed', label: '미처리' },
  { key: 'processed', label: '처리완료' },
  { key: 'discarded', label: '버림' },
];

export function CardCollection() {
  const [tab, setTab] = useState<BusinessCardStatus>('unprocessed');
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ocrEnabled, setOcrEnabled] = useState(false);

  const refresh = useCallback(async (status: BusinessCardStatus) => {
    setLoaded(false);
    try {
      setCards(await fetchCards(status));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조회 실패');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void refresh(tab); }, [tab, refresh]);
  useEffect(() => { isOcrEnabled().then(setOcrEnabled); }, []);

  const active = cards.find((c) => c.id === activeId) ?? null;

  // 처리 후: 목록 갱신 + 다음 카드로 이동
  async function afterAction() {
    const remaining = cards.filter((c) => c.id !== activeId);
    setCards(remaining);
    const next = remaining[0] ?? null;
    setActiveId(next ? next.id : null);
    if (!next) void refresh(tab);
  }

  function skipToNext() {
    if (!active) return;
    const idx = cards.findIndex((c) => c.id === active.id);
    const next = cards[idx + 1] ?? null;
    setActiveId(next ? next.id : null);
  }

  // ── 처리 화면 ──
  if (active) {
    return (
      <div>
        <Toaster position="top-center" />
        <button onClick={() => setActiveId(null)} className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 mb-3">
          <ChevronLeft className="w-3 h-3" /> 수집함으로
        </button>
        <div className="text-sm text-gray-400 mb-3">
          {active.event_name && <span className="mr-2">📍 {active.event_name}</span>}
          남은 {tab === 'unprocessed' ? '미처리' : ''} {cards.length}장
        </div>
        <CardProcess card={active} ocrEnabled={ocrEnabled} onDone={afterAction} onSkip={skipToNext} />
      </div>
    );
  }

  // ── 그리드 ──
  return (
    <div>
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                tab === t.key
                  ? 'bg-[#c8962e]/15 text-[#e0bf70] border-[#c8962e]/30'
                  : 'text-gray-400 border-white/[0.06] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link href="/admin/vendors/cards/capture" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white">
            <Camera className="w-4 h-4" /> 촬영
          </Link>
          <button onClick={() => refresh(tab)} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중…</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500">
          {tab === 'unprocessed' ? '미처리 명함이 없습니다. 현장에서 촬영해 오세요.' : '해당 명함이 없습니다.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className="text-left rounded-xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-[#181c28] to-[#13161f] hover:border-[#c8962e]/40 transition-colors"
            >
              <div className="aspect-[16/10] bg-black/40 flex items-center justify-center overflow-hidden">
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_url} alt="명함" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div className="p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-gray-500 truncate">{c.event_name ?? '행사 미기재'}</span>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${CARD_STATUS_BADGE[c.status].color}`}>
                    {CARD_STATUS_BADGE[c.status].label}
                  </span>
                </div>
                {c.quick_memo && <div className="text-xs text-gray-300 mt-1 truncate">{c.quick_memo}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
