'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { isDevMode } from '@/lib/env';
import { formatKRW, formatNumber, formatDate } from '@/lib/utils';
import { ORDER_STATUS_BADGE, type OrderStatus } from '@/types';

interface WeeklyPoint { week: string; revenue: number; orders: number }
interface TopCustomer { name: string; amount: number }
interface StatusSlice { name: string; value: number; status: OrderStatus }

// 회장 전용 차트 묶음 — 12주 매출 추세, 거래처 매출 순위, 주문 상태 분포
// ⚠️ 회장 권한은 SELECT 만 — RLS 가 자동으로 강제. 편집 UI 없음.
export function ChairmanCharts() {
  const [weekly, setWeekly] = useState<WeeklyPoint[]>([]);
  const [top, setTop] = useState<TopCustomer[]>([]);
  const [statusDist, setStatusDist] = useState<StatusSlice[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isDevMode) { setLoaded(true); return; }
    async function load() {
      const supabase = createClient();

      // 지난 12주 데이터 (RLS: chair_read_orders 로 SELECT 허용됨)
      const since = new Date();
      since.setDate(since.getDate() - 12 * 7);
      since.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status, customer_id, created_at, customers(company_name)')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      type OrderRow = {
        total_amount: number | null;
        status: OrderStatus;
        customer_id: string;
        created_at: string;
        customers: { company_name: string } | null;
      };
      const rows = (orders ?? []) as unknown as OrderRow[];

      // 1) 주별 매출/주문수 (월요일 시작 기준)
      const weekMap = new Map<string, WeeklyPoint>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        // 해당 날짜의 월요일로 정규화
        const dow = (d.getDay() + 6) % 7; // 월=0
        d.setDate(d.getDate() - dow);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        weekMap.set(key, { week: key.slice(5), revenue: 0, orders: 0 });
      }
      for (const o of rows) {
        const od = new Date(o.created_at);
        const dow = (od.getDay() + 6) % 7;
        od.setDate(od.getDate() - dow);
        od.setHours(0, 0, 0, 0);
        const key = od.toISOString().slice(0, 10);
        const wp = weekMap.get(key);
        if (wp) {
          wp.revenue += o.total_amount ?? 0;
          wp.orders += 1;
        }
      }
      setWeekly([...weekMap.values()]);

      // 2) 거래처별 매출 상위 5
      const custMap = new Map<string, TopCustomer>();
      for (const o of rows) {
        const name = o.customers?.company_name ?? '-';
        const prev = custMap.get(o.customer_id) ?? { name, amount: 0 };
        prev.amount += o.total_amount ?? 0;
        custMap.set(o.customer_id, prev);
      }
      setTop([...custMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5));

      // 3) 주문 상태 분포 (전체 — 12주 한정 아님)
      const { data: allOrders } = await supabase
        .from('orders').select('status');
      const statusCount = new Map<OrderStatus, number>();
      for (const o of (allOrders ?? []) as { status: OrderStatus }[]) {
        statusCount.set(o.status, (statusCount.get(o.status) ?? 0) + 1);
      }
      setStatusDist(
        [...statusCount.entries()]
          .map(([status, value]) => ({
            status,
            name: ORDER_STATUS_BADGE[status]?.label ?? status,
            value,
          }))
          .sort((a, b) => b.value - a.value),
      );

      setLoaded(true);
    }
    load();
  }, []);

  if (isDevMode) {
    return (
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
        <CardContent className="py-12 text-center text-sm text-amber-300">
          🛠️ 개발 모드 — 차트는 Supabase 연결 후 실데이터로 표시됩니다.
        </CardContent>
      </Card>
    );
  }
  if (!loaded) return <div className="text-sm text-gray-500">차트 데이터 불러오는 중...</div>;

  const totalRevenue = weekly.reduce((s, w) => s + w.revenue, 0);
  const totalOrders  = weekly.reduce((s, w) => s + w.orders, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 매출 추세 (큼) */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base text-gray-200 flex items-center justify-between">
            <span>📈 주별 매출 추세 (최근 12주)</span>
            <span className="text-xs text-[#c8962e] font-bold">
              총 {formatKRW(totalRevenue)} · {totalOrders}건
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {weekly.every((w) => w.revenue === 0) ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              해당 기간 매출 데이터가 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#c8962e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#c8962e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" vertical={false} />
                <XAxis dataKey="week" stroke="#888" fontSize={11} />
                <YAxis
                  stroke="#888" fontSize={11}
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M`
                                       : v >= 1_000     ? `${(v / 1_000).toFixed(0)}K`
                                       : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13161f', border: '1px solid #2a2f3e',
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    const v = Number(value);
                    return name === 'revenue' ? formatKRW(v) : `${v}건`;
                  }}
                  labelStyle={{ color: '#c8962e' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#c8962e" strokeWidth={2}
                  fill="url(#goldFill)" name="매출" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 주문 상태 분포 (작음) */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
        <CardHeader>
          <CardTitle className="text-base text-gray-200">🍩 주문 상태 분포</CardTitle>
          <p className="text-xs text-gray-500 mt-1">전체 주문 누적</p>
        </CardHeader>
        <CardContent className="h-72">
          {statusDist.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              주문 없음
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name"
                  innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {statusDist.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLOR[s.status]} stroke="#13161f" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13161f', border: '1px solid #2a2f3e',
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(value) => `${Number(value)}건`}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: '#aaa' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 거래처 매출 순위 (전체 너비) */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base text-gray-200">🏆 거래처 매출 순위 (최근 12주)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {top.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              해당 기간 주문 데이터가 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ top: 10, right: 20, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" horizontal={false} />
                <XAxis type="number" stroke="#888" fontSize={11}
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M`
                                       : v >= 1_000     ? `${(v / 1_000).toFixed(0)}K`
                                       : String(v)} />
                <YAxis type="category" dataKey="name" stroke="#aaa" fontSize={12}
                  width={150} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13161f', border: '1px solid #2a2f3e',
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(value) => formatKRW(Number(value))}
                  labelStyle={{ color: '#c8962e' }}
                />
                <Bar dataKey="amount" fill="#c8962e" radius={[0, 4, 4, 0]} name="매출" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:    '#6b7280',
  approved:   '#3b82f6',
  processing: '#8b5cf6',
  shipped:    '#22c55e',
  cancelled:  '#4b5563',
  rejected:   '#ef4444',
  returned:   '#f97316',
};

// Avoid unused warning if formatDate not used (silent helper for typing)
void formatDate; void formatNumber;
