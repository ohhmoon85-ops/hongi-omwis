'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW } from '@/lib/utils';
import { ORDER_STATUS_BADGE, type OrderStatus } from '@/types';

interface DailyPoint { day: string; revenue: number; orders: number }
interface StatusBar { name: string; value: number; status: OrderStatus }

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:    '#6b7280',
  approved:   '#3b82f6',
  processing: '#8b5cf6',
  shipped:    '#22c55e',
  cancelled:  '#4b5563',
  rejected:   '#ef4444',
  returned:   '#f97316',
};

const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}K`
  : String(v);

export function DashboardCharts() {
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [status, setStatus] = useState<StatusBar[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isDevMode) { setLoaded(true); return; }
    (async () => {
      try {
        const supabase = createClient();
        const since = new Date();
        since.setDate(since.getDate() - 13);
        since.setHours(0, 0, 0, 0);

        const { data: recent } = await supabase
          .from('orders')
          .select('total_amount, created_at')
          .gte('created_at', since.toISOString());

        // 최근 14일 일별 매출/주문수 (브라우저 로컬=KST 기준)
        const map = new Map<string, DailyPoint>();
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(0, 0, 0, 0);
          const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
          map.set(key, { day: `${d.getMonth() + 1}/${d.getDate()}`, revenue: 0, orders: 0 });
        }
        for (const o of recent ?? []) {
          const d = new Date(o.created_at);
          d.setHours(0, 0, 0, 0);
          const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
          const p = map.get(key);
          if (p) { p.revenue += o.total_amount ?? 0; p.orders += 1; }
        }
        setDaily([...map.values()]);

        // 전체 주문 상태 분포
        const { data: all } = await supabase.from('orders').select('status');
        const sc = new Map<OrderStatus, number>();
        for (const o of (all ?? []) as { status: OrderStatus }[]) {
          sc.set(o.status, (sc.get(o.status) ?? 0) + 1);
        }
        setStatus(
          [...sc.entries()]
            .map(([s, v]) => ({ status: s, name: ORDER_STATUS_BADGE[s]?.label ?? s, value: v }))
            .sort((a, b) => b.value - a.value),
        );
      } catch (err) {
        console.error('[dashboard charts]', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (isDevMode) return null;
  if (!loaded) return <div className="mt-6 text-sm text-gray-500">차트 불러오는 중...</div>;

  const monthRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const tooltipStyle = {
    backgroundColor: '#13161f', border: '1px solid #2a2f3e',
    borderRadius: 8, fontSize: 12,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
      {/* 매출 추세 */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-200 flex items-center justify-between">
            <span>📈 일별 매출 추세 (최근 14일)</span>
            <span className="text-xs text-[#c8962e] font-bold">{formatKRW(monthRevenue)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {daily.every((d) => d.revenue === 0) ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              최근 14일 매출 데이터가 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8962e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#c8962e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" vertical={false} />
                <XAxis dataKey="day" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} tickFormatter={compact} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#c8962e' }}
                  formatter={(v) => formatKRW(Number(v))} />
                <Area type="monotone" dataKey="revenue" stroke="#c8962e" strokeWidth={2}
                  fill="url(#dashGold)" name="매출" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 주문 상태 분포 */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-200">📊 주문 상태 분포</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {status.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              주문이 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={status} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" horizontal={false} />
                <XAxis type="number" stroke="#888" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#aaa" fontSize={12} width={64} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v)}건`} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} name="건수">
                  {status.map((s) => <Cell key={s.status} fill={STATUS_COLOR[s.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
