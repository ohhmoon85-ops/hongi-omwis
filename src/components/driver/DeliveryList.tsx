'use client';

import { useEffect, useState } from 'react';
import {
  fetchDeliveries, driverAction,
  DELIVERY_STATUS_BADGE, type DeliveryView,
} from '@/lib/deliveries';
import { isDevMode } from '@/lib/dev-data';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Truck, MapPin, CheckCircle2 } from 'lucide-react';

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

  async function act(d: DeliveryView, action: 'depart' | 'complete') {
    setBusyId(d.id);
    try {
      await driverAction(d.id, action);
      toast.success(action === 'depart' ? '출발 처리되었습니다' : '배송 완료 — 주문이 완료 처리됩니다');
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

  const activeCount = items.filter((d) => d.status === 'scheduled' || d.status === 'departed').length;

  return (
    <>
      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === f.key
                  ? 'bg-[#1a3d6b] text-white border-[#1a3d6b]'
                  : 'bg-[#171b26] text-gray-300 border-[#2a2f3e] hover:border-[#1a3d6b]'
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
        <button onClick={refresh} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
          <RefreshCw className="w-4 h-4" />
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
            return (
              <Card key={d.id} className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{d.order_number ?? '—'}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 text-sm text-gray-300 mt-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                        <span>{d.delivery_address ?? '배송지 미지정'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1.5 space-x-3">
                        <span>예정일: {formatDate(d.scheduled_date)}</span>
                        {d.departure_time && <span>출발: {formatDateTime(d.departure_time)}</span>}
                        {d.arrival_time && <span>도착: {formatDateTime(d.arrival_time)}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {d.status === 'scheduled' && (
                        <Button
                          onClick={() => act(d, 'depart')}
                          disabled={busyId === d.id}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <Truck className="w-4 h-4 mr-1" />출발
                        </Button>
                      )}
                      {d.status === 'departed' && (
                        <Button
                          onClick={() => act(d, 'complete')}
                          disabled={busyId === d.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />배송 완료
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
