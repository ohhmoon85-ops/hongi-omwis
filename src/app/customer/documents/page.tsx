// ============================================================================
// /customer/documents — 거래처 본인의 세금계산서 목록 + PDF 다운로드
// RLS: cust_read_own_invoices 정책으로 자사 invoices 만 자동 필터링됨
// ============================================================================

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/env';
import { formatKRW, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Download, AlertCircle } from 'lucide-react';

interface InvoiceRow {
  id: string;
  order_id: string;
  mgt_key: string;
  nts_confirm_number: string | null;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'issued' | 'sent' | 'failed' | 'cancelled';
  issue_date: string | null;
  is_mock: boolean;
  orders: { order_number: string } | null;
}

const STATUS_BADGE = {
  draft:     { label: '작성 중', color: 'bg-gray-100 text-gray-600' },
  issued:    { label: '발행 완료', color: 'bg-green-100 text-green-700' },
  sent:      { label: '발송 완료', color: 'bg-blue-100 text-blue-700' },
  failed:    { label: '발행 실패', color: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소',     color: 'bg-gray-200 text-gray-500' },
};

async function loadInvoices(): Promise<InvoiceRow[]> {
  if (isDevMode) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, order_id, mgt_key, nts_confirm_number,
      supply_amount, tax_amount, total_amount,
      status, issue_date, is_mock,
      orders(order_number)
    `)
    .order('issue_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[customer/documents] invoices fetch failed:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({ ...r, orders: r.orders ?? null }));
}

export default async function CustomerDocumentsPage() {
  const invoices = await loadInvoices();

  const totalSupply = invoices.reduce((s, i) => s + (i.supply_amount ?? 0), 0);
  const totalTax    = invoices.reduce((s, i) => s + (i.tax_amount ?? 0), 0);
  const totalAmount = invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-app-light p-4 sm:p-6 text-[#1c1c1c]">
      <header className="mb-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm text-[#1a3d6b] font-semibold">OMWIS · 거래처</div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">세금계산서</h1>
            <p className="text-sm text-gray-600 mt-1">
              발행된 세금계산서를 조회·PDF 저장합니다. 거래처 본인의 문서만 표시됩니다.
            </p>
          </div>
          <Link
            href="/customer/orders"
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 h-10 rounded-lg bg-white border border-[#1a3d6b]/20 text-[#1a3d6b] hover:bg-[#1a3d6b] hover:text-white transition text-sm whitespace-nowrap"
          >
            ← 주문 내역
          </Link>
        </div>
      </header>

      {/* 요약 — 누적 매입 */}
      <div className="grid grid-cols-3 gap-3 mb-4 max-w-5xl">
        <Stat label="공급가액 누계" value={formatKRW(totalSupply)} />
        <Stat label="세액 누계"     value={formatKRW(totalTax)} />
        <Stat label="합계금액 누계" value={formatKRW(totalAmount)} highlight />
      </div>

      {isDevMode ? (
        <Card className="max-w-5xl">
          <CardContent className="py-12 text-center text-sm text-amber-600">
            🛠️ 개발 모드 — 세금계산서는 Supabase 연결 후 조회 가능합니다.
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card className="max-w-5xl">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <div className="text-sm text-gray-500">아직 발행된 세금계산서가 없습니다.</div>
            <Link
              href="/customer/order"
              className="mt-3 inline-block text-sm text-[#1a3d6b] hover:underline"
            >
              주문하러 가기 →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-w-5xl">
          {invoices.map((inv) => {
            const badge = STATUS_BADGE[inv.status];
            return (
              <Card key={inv.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-gray-700">
                          {inv.orders?.order_number ?? inv.mgt_key}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                        {inv.is_mock && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            데모
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        작성일 {formatDate(inv.issue_date)}
                        {inv.nts_confirm_number && (
                          <span className="ml-2">· 국세청 승인번호 {inv.nts_confirm_number.slice(0, 16)}...</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-gray-500">합계금액</div>
                      <div className="text-lg sm:text-xl font-bold text-[#1a3d6b] leading-tight">
                        {formatKRW(inv.total_amount)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 flex gap-3">
                      <span>공급가액 {formatKRW(inv.supply_amount)}</span>
                      <span>세액 {formatKRW(inv.tax_amount)}</span>
                    </div>
                    {(inv.status === 'issued' || inv.status === 'sent') && (
                      <Link
                        href={`/customer/invoices/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 h-10 text-sm bg-[#1a3d6b] text-white rounded-lg hover:bg-[#235490] transition"
                      >
                        <Download className="w-4 h-4" />
                        PDF 보기
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500 max-w-5xl">
        💡 「PDF 보기」 → 새 탭으로 인쇄용 양식 → 브라우저 인쇄(Ctrl+P) → 「PDF 로 저장」.
        Chrome / Edge / Safari 모두 지원됩니다.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
      <div className="text-[10px] sm:text-xs text-gray-500">{label}</div>
      <div className={`text-base sm:text-xl font-bold mt-1 leading-tight ${highlight ? 'text-[#1a3d6b]' : 'text-gray-800'}`}>
        {value}
      </div>
    </div>
  );
}
