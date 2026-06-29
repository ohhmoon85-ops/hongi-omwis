'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadDevCustomers, priceTierBadge } from '@/lib/dev-customers';
import { isDevMode } from '@/lib/dev-data';
import { createClient } from '@/lib/supabase/client';
import { formatKRW } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, ArrowRight } from 'lucide-react';
import type { Customer } from '@/types';

type FilterKey = 'all' | 'active' | 'inactive' | 'ex-dealer' | 'direct';

const FILTERS: Array<{ key: FilterKey; label: string; desc: string }> = [
  { key: 'all',       label: '전체',         desc: '' },
  { key: 'active',    label: '활성',         desc: 'is_active=true' },
  { key: 'inactive',  label: '비활성',       desc: '거래 종료' },
  { key: 'ex-dealer', label: '대리점 이관',  desc: 'former_dealer 보유' },
  { key: 'direct',    label: '신규 직거래',  desc: '대리점 경유 없음' },
];

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<FilterKey>('active');
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      if (isDevMode) {
        setCustomers(loadDevCustomers());
      } else {
        const { data, error } = await createClient()
          .from('customers').select('*').order('company_name');
        if (error) console.error('[customers] fetch failed:', error.message);
        else setCustomers((data ?? []) as Customer[]);
      }
      setLoaded(true);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = customers;
    if (filter === 'active')    list = list.filter((c) => c.is_active);
    if (filter === 'inactive')  list = list.filter((c) => !c.is_active);
    if (filter === 'ex-dealer') list = list.filter((c) => c.former_dealer);
    if (filter === 'direct')    list = list.filter((c) => !c.former_dealer);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.former_dealer?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [customers, filter, query]);

  // 통계
  const totalCount = customers.length;
  const activeCount = customers.filter((c) => c.is_active).length;
  const exDealerCount = customers.filter((c) => c.former_dealer).length;
  const totalReceivable = customers.reduce((s, c) => s + c.current_balance, 0);

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="총 거래처"        value={String(totalCount)}        sub="전체" />
        <StatCard label="활성 거래처"      value={String(activeCount)}       sub="거래 중" />
        <StatCard label="대리점 이관"      value={String(exDealerCount)}     sub="D2C 전환" />
        <StatCard label="총 미수금"        value={formatKRW(totalReceivable)} sub="전 거래처 합산" />
      </div>

      {/* 검색 + 필터 + 신규 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="회사명·담당자·전화·대리점명 검색"
            className="pl-9 bg-[#171b26] border-[#2a2f3e] text-white"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              title={f.desc}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === f.key
                  ? 'bg-[#1a3d6b] text-white border-[#1a3d6b]'
                  : 'bg-[#171b26] text-gray-300 border-[#2a2f3e] hover:border-[#1a3d6b]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Link href="/admin/customers/new" className="ml-auto">
          <Button className="bg-[#1a3d6b] hover:bg-[#235490] text-white">
            <Plus className="w-4 h-4 mr-1" />신규 거래처
          </Button>
        </Link>
      </div>

      {/* 목록 */}
      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            조건에 맞는 거래처가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const tier = priceTierBadge(c.price_tier);
            const overLimit = c.current_balance > c.credit_limit;
            return (
              <Link key={c.id} href={`/admin/customers/${c.id}`}>
                <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white hover:border-[#1a3d6b] transition cursor-pointer">
                  <CardContent className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-[260px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-base">{c.company_name}</span>
                          {!c.is_active && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 border border-gray-600">
                              비활성
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${tier.color}`}>
                            {tier.label}
                          </span>
                          {c.former_dealer && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              {c.former_dealer} → 직거래
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {c.contact_name} · {c.phone} · {c.email}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.address}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-gray-500">미수금 / 한도</div>
                        <div className={`text-sm font-semibold ${overLimit ? 'text-red-400' : 'text-gray-200'}`}>
                          {formatKRW(c.current_balance)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          / {formatKRW(c.credit_limit)}
                        </div>
                        {overLimit && (
                          <div className="text-[10px] text-red-400 mt-0.5">한도 초과</div>
                        )}
                      </div>

                      <ArrowRight className="w-4 h-4 text-gray-500 self-center" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {isDevMode && (
        <p className="text-xs text-amber-400 pt-2">
          🛠️ 개발 모드 — 거래처는 브라우저 localStorage 에 저장됩니다 (시드 3개 자동 등록).
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardContent className="py-4">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-2xl font-bold text-[#c8962e] mt-1">{value}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}
