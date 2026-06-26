'use client';

import { useEffect, useState } from 'react';
import {
  fetchDeliveries, driverAction, saveDeliveryPhotoPath,
  DELIVERY_STATUS_BADGE, type DeliveryView,
} from '@/lib/deliveries';
import { uploadDeliveryPhoto } from '@/lib/storage';
import { isDevMode } from '@/lib/env';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';
import {
  RefreshCw, Truck, MapPin, CheckCircle2, Phone, Map as MapIcon, Camera, X,
} from 'lucide-react';

const FILTERS: Array<{ key: DeliveryView['status'] | 'active' | 'all'; label: string }> = [
  { key: 'active',    label: '진행 중' },
  { key: 'scheduled', label: '배차 대기' },
  { key: 'departed',  label: '배송 중' },
  { key: 'delivered', label: '완료' },
  { key: 'all',       label: '전체' },
];

export function DeliveryList() {
  const [items, setItems] = useState<DeliveryView[]>([]);
  const [filter, setFilter] = useState<DeliveryView['status'] | 'active' | 'all'>('active');
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 배송 완료 모달 — 사진 첨부 후 처리
  const [completing, setCompleting] = useState<DeliveryView | null>(null);

  async function refresh() {
    if (isDevMode) { setLoaded(true); return; }
    try {
      setItems(await fetchDeliveries());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '배송 조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { refresh(); }, []);

  async function depart(d: DeliveryView) {
    setBusyId(d.id);
    try {
      await driverAction(d.id, 'depart');
      toast.success('출발 처리되었습니다');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  }

  async function completeWithPhoto(d: DeliveryView, file: File | null) {
    setBusyId(d.id);
    try {
      // 1) 사진 업로드 (있으면)
      if (file) {
        const { path } = await uploadDeliveryPhoto(file);
        await saveDeliveryPhotoPath(d.id, path);
      }
      // 2) 배송 완료 처리 (API 가 orders.status='delivered' 동기화)
      await driverAction(d.id, 'complete');
      toast.success('배송 완료 — 주문이 완료 처리됩니다');
      setCompleting(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = items.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'active') return d.status === 'scheduled' || d.status === 'departed';
    return d.status === filter;
  });

  const activeCount = items.filter(
    (d) => d.status === 'scheduled' || d.status === 'departed',
  ).length;

  return (
    <>
      <Toaster position="top-center" />

      {/* 상단 필터 + 새로고침 */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 h-9 text-sm rounded-full border transition ${
                filter === f.key
                  ? 'bg-[#1a3d6b] text-white border-[#1a3d6b]'
                  : 'bg-[#171b26] text-gray-300 border-[#2a2f3e] active:bg-[#1a3d6b]/30'
              }`}
            >
              {f.label}
              {f.key === 'active' && activeCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px]">
                  {activeCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="p-2.5 text-gray-400 hover:text-white active:bg-white/[0.04] rounded-full"
          aria-label="새로고침"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {isDevMode ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-amber-400">
            🛠️ 개발 모드 — 배송 데이터는 Supabase 연결 시 표시됩니다.
          </CardContent>
        </Card>
      ) : !loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            해당 상태의 배송 건이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const badge = DELIVERY_STATUS_BADGE[d.status];
            const phone = d.customer_phone?.replace(/-/g, '') ?? null;
            const mapUrl = d.delivery_address
              ? `https://map.kakao.com/link/search/${encodeURIComponent(d.delivery_address)}`
              : null;
            return (
              <Card key={d.id} className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
                <CardContent className="py-4">
                  {/* 상단: 주문번호 + 상태 */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono text-sm">{d.order_number ?? '—'}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* 거래처 */}
                  {d.customer_name && (
                    <div className="text-base font-semibold text-gray-100">{d.customer_name}</div>
                  )}

                  {/* 배송지 */}
                  <div className="flex items-start gap-1.5 text-sm text-gray-300 mt-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                    <span className="flex-1 break-keep">{d.delivery_address ?? '배송지 미지정'}</span>
                  </div>

                  {/* 시간 정보 */}
                  <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>예정 {formatDate(d.scheduled_date)}</span>
                    {d.departure_time && <span>출발 {formatDateTime(d.departure_time)}</span>}
                    {d.arrival_time && <span>도착 {formatDateTime(d.arrival_time)}</span>}
                  </div>

                  {/* 빠른 액션 — 전화 / 지도 / 출발 또는 완료 */}
                  <div className="mt-3 pt-3 border-t border-[#1f2433] grid grid-cols-2 gap-2">
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex items-center justify-center gap-1.5 h-12 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 active:bg-blue-600/40"
                      >
                        <Phone className="w-4 h-4" />
                        담당자 전화
                      </a>
                    )}
                    {mapUrl && (
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 h-12 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 active:bg-purple-600/40"
                      >
                        <MapIcon className="w-4 h-4" />
                        길찾기 (카카오맵)
                      </a>
                    )}
                  </div>

                  {/* 메인 액션 — 한 손 조작용 큰 버튼 */}
                  <div className="mt-2">
                    {d.status === 'scheduled' && (
                      <Button
                        onClick={() => depart(d)}
                        disabled={busyId === d.id}
                        className="w-full h-14 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-base font-semibold"
                      >
                        <Truck className="w-5 h-5 mr-2" />
                        {busyId === d.id ? '처리 중...' : '출발 처리'}
                      </Button>
                    )}
                    {d.status === 'departed' && (
                      <Button
                        onClick={() => setCompleting(d)}
                        disabled={busyId === d.id}
                        className="w-full h-14 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-base font-semibold"
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        배송 완료 (사진 첨부)
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 배송 완료 모달 — 사진 첨부 */}
      {completing && (
        <CompletionModal
          delivery={completing}
          busy={busyId === completing.id}
          onCancel={() => setCompleting(null)}
          onSubmit={(file) => completeWithPhoto(completing, file)}
        />
      )}
    </>
  );
}

// ─── 배송 완료 모달 ──────────────────────────────────────────────────────
function CompletionModal({
  delivery: d, busy, onCancel, onSubmit,
}: {
  delivery: DeliveryView;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171b26] border border-white/[0.06] rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">배송 완료 처리</h3>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-gray-300 mb-4">
          <div className="font-mono text-xs text-gray-500">{d.order_number}</div>
          {d.customer_name && <div className="mt-0.5">{d.customer_name}</div>}
        </div>

        {/* 사진 첨부 */}
        <label className="block">
          <div className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" />
            완료 사진 (선택 — 거래처 확인용)
          </div>
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="완료 사진" className="w-full rounded-lg max-h-64 object-cover" />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); pickFile(null); }}
                className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full"
                aria-label="사진 제거"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#2a2f3e] rounded-lg h-32 flex items-center justify-center text-sm text-gray-500">
              <Camera className="w-6 h-6 mr-2" /> 사진 촬영 / 선택
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>

        {/* 액션 */}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={busy}
            className="h-12"
          >
            취소
          </Button>
          <Button
            onClick={() => onSubmit(file)}
            disabled={busy}
            className="h-12 bg-green-600 hover:bg-green-700 text-white text-base font-semibold"
          >
            <CheckCircle2 className="w-5 h-5 mr-1" />
            {busy ? '처리 중...' : '완료'}
          </Button>
        </div>

        <p className="text-[10px] text-gray-500 mt-3 text-center">
          {file ? '✅ 사진 첨부됨 — 완료 시 함께 업로드됩니다' : '사진 없이도 완료 가능 (선택사항)'}
        </p>
      </div>
    </div>
  );
}
