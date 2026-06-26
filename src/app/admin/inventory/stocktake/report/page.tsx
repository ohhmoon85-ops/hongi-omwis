// ============================================================================
// /admin/inventory/stocktake/report — 월별 실사 결과 보고서 (PDF)
// ----------------------------------------------------------------------------
// inventory_logs 의 log_type='adjust' 행을 월별로 집계 → A4 인쇄 양식
// 쿼리스트링: ?ym=YYYY-MM (기본값: 이번달)
// ============================================================================

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { SUPPLIER } from '@/lib/company';
import { formatNumber, formatDate } from '@/lib/utils';
import InvoicePrintActions from '@/components/admin/InvoicePrintActions';

interface PageProps {
  searchParams: { ym?: string };
}

interface AdjustRow {
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  lot_number: string | null;
  location: string | null;
  quantity: number;      // 차이 (실사 - 장부, 음수 = 부족)
  memo: string | null;
  unit: string;
}

function kstYearMonth(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBoundaries(ym: string): { startISO: string; endISO: string; label: string } {
  const [yStr, mStr] = ym.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  // KST 월 시작·다음 달 시작
  const start = new Date(Date.UTC(y, m - 1, 1) - 9 * 3600 * 1000);
  const end   = new Date(Date.UTC(y, m, 1)     - 9 * 3600 * 1000);
  return {
    startISO: start.toISOString(),
    endISO:   end.toISOString(),
    label:    `${y}년 ${m}월`,
  };
}

async function loadReport(ym: string) {
  const admin = createAdminClient();
  const { startISO, endISO, label } = monthBoundaries(ym);

  const { data: logs } = await admin
    .from('inventory_logs')
    .select(`
      id, created_at, product_id, quantity, memo,
      inventory_id, inventory(lot_number, location),
      products(name, unit)
    `)
    .eq('log_type', 'adjust')
    .gte('created_at', startISO)
    .lt('created_at', endISO)
    .order('created_at', { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: AdjustRow[] = (logs ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    product_id: r.product_id,
    product_name: r.products?.name ?? '-',
    lot_number: r.inventory?.lot_number ?? null,
    location: r.inventory?.location ?? null,
    quantity: Number(r.quantity),
    memo: r.memo,
    unit: r.products?.unit ?? 'kg',
  }));

  // 품목별 합계 (양수/음수 분리)
  const byProduct = new Map<string, { name: string; unit: string; gain: number; loss: number; count: number }>();
  for (const r of rows) {
    const prev = byProduct.get(r.product_id) ?? { name: r.product_name, unit: r.unit, gain: 0, loss: 0, count: 0 };
    if (r.quantity > 0) prev.gain += r.quantity;
    else if (r.quantity < 0) prev.loss += -r.quantity;
    prev.count++;
    byProduct.set(r.product_id, prev);
  }

  return { rows, byProduct: Array.from(byProduct.values()), label };
}

export default async function StocktakeReportPage({ searchParams }: PageProps) {
  const ym = searchParams.ym ?? kstYearMonth();
  const { rows, byProduct, label } = await loadReport(ym);

  const total = rows.length;
  const gainCount = rows.filter((r) => r.quantity > 0).length;
  const lossCount = rows.filter((r) => r.quantity < 0).length;
  const netDiff = rows.reduce((s, r) => s + r.quantity, 0);
  const generatedAt = new Date();

  // 이전 달 / 다음 달 링크
  const [y, m] = ym.split('-').map((v) => parseInt(v, 10));
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
        }
      ` }} />

      {/* 화면용 헤더 */}
      <div className="no-print bg-[#0f1117] border-b border-[#1f2433] p-4 sticky top-0 z-10">
        <div className="max-w-[210mm] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/inventory/stocktake" className="text-xs text-gray-400 hover:text-white">
              ← 재고 실사
            </Link>
            <h1 className="text-xl font-bold text-white mt-1">
              실사 보고서 — {label}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`?ym=${prev}`}
              className="px-3 h-9 inline-flex items-center text-sm text-gray-300 border border-[#2a2f3e] rounded hover:bg-white/[0.05]"
            >
              ← 이전 달
            </Link>
            <Link
              href={`?ym=${next}`}
              className="px-3 h-9 inline-flex items-center text-sm text-gray-300 border border-[#2a2f3e] rounded hover:bg-white/[0.05]"
            >
              다음 달 →
            </Link>
            <InvoicePrintActions />
          </div>
        </div>
      </div>

      {/* A4 인쇄 영역 */}
      <div
        className="bg-white text-[#111] mx-auto my-8 shadow-lg"
        style={{ width: '210mm', minHeight: '297mm', padding: '14mm' }}
      >
        {/* 제목 */}
        <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
          <h2 className="text-2xl font-bold tracking-wider">월별 재고 실사 보고서</h2>
          <div className="text-base text-gray-700 mt-1">{label}</div>
        </div>

        {/* 회사 정보 + 발행 정보 */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          <div className="border border-gray-300 p-3">
            <div className="font-semibold text-gray-700 mb-1">📍 회사 정보</div>
            <div>상호: <b>{SUPPLIER.name}</b></div>
            <div>대표자: {SUPPLIER.ceo}</div>
            <div>등록번호: {SUPPLIER.bizNumber}</div>
          </div>
          <div className="border border-gray-300 p-3">
            <div className="font-semibold text-gray-700 mb-1">📄 보고서 정보</div>
            <div>대상 기간: {label}</div>
            <div>출력 일시: {formatDate(generatedAt)}</div>
            <div>총 조정 건수: <b>{total}건</b></div>
          </div>
        </div>

        {/* 요약 4지표 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Stat label="전체 조정" value={`${total}건`} />
          <Stat label="잉여 (실사>장부)" value={`${gainCount}건`} color="text-blue-700" />
          <Stat label="부족 (실사<장부)" value={`${lossCount}건`} color="text-red-700" />
          <Stat
            label="순 차이"
            value={`${netDiff > 0 ? '+' : ''}${formatNumber(netDiff, 1)}kg`}
            color={netDiff > 0 ? 'text-blue-700' : netDiff < 0 ? 'text-red-700' : 'text-gray-700'}
          />
        </div>

        {/* 품목별 요약 */}
        <div className="text-sm font-semibold text-gray-700 mb-2">품목별 요약</div>
        <table className="w-full border-collapse border border-gray-800 text-xs mb-5">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-800 p-1.5 text-left">품목</th>
              <th className="border border-gray-800 p-1.5 text-right w-24">조정 건수</th>
              <th className="border border-gray-800 p-1.5 text-right w-28">잉여 합계</th>
              <th className="border border-gray-800 p-1.5 text-right w-28">부족 합계</th>
              <th className="border border-gray-800 p-1.5 text-right w-28">순 차이</th>
            </tr>
          </thead>
          <tbody>
            {byProduct.length === 0 ? (
              <tr><td colSpan={5} className="border border-gray-800 p-3 text-center text-gray-500">
                해당 월에 조정 이력이 없습니다.
              </td></tr>
            ) : byProduct.map((p) => {
              const net = p.gain - p.loss;
              return (
                <tr key={p.name}>
                  <td className="border border-gray-800 p-1.5">{p.name}</td>
                  <td className="border border-gray-800 p-1.5 text-right">{p.count}</td>
                  <td className="border border-gray-800 p-1.5 text-right text-blue-700">
                    {p.gain > 0 ? `+${formatNumber(p.gain, 1)}${p.unit}` : '-'}
                  </td>
                  <td className="border border-gray-800 p-1.5 text-right text-red-700">
                    {p.loss > 0 ? `-${formatNumber(p.loss, 1)}${p.unit}` : '-'}
                  </td>
                  <td className={`border border-gray-800 p-1.5 text-right font-semibold ${
                    net > 0 ? 'text-blue-700' : net < 0 ? 'text-red-700' : ''
                  }`}>
                    {net > 0 ? '+' : ''}{formatNumber(net, 1)}{p.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 상세 조정 이력 */}
        <div className="text-sm font-semibold text-gray-700 mb-2">상세 조정 이력</div>
        <table className="w-full border-collapse border border-gray-800 text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-800 p-1.5 text-left w-20">일자</th>
              <th className="border border-gray-800 p-1.5 text-left">품목</th>
              <th className="border border-gray-800 p-1.5 text-left w-24">Lot</th>
              <th className="border border-gray-800 p-1.5 text-left w-20">위치</th>
              <th className="border border-gray-800 p-1.5 text-right w-24">조정량</th>
              <th className="border border-gray-800 p-1.5 text-left">사유 / 메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="border border-gray-800 p-3 text-center text-gray-500">
                상세 조정 이력 없음
              </td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td className="border border-gray-800 p-1.5">{formatDate(r.created_at)}</td>
                <td className="border border-gray-800 p-1.5">{r.product_name}</td>
                <td className="border border-gray-800 p-1.5">{r.lot_number ?? '-'}</td>
                <td className="border border-gray-800 p-1.5">{r.location ?? '-'}</td>
                <td className={`border border-gray-800 p-1.5 text-right font-semibold ${
                  r.quantity > 0 ? 'text-blue-700' : r.quantity < 0 ? 'text-red-700' : ''
                }`}>
                  {r.quantity > 0 ? '+' : ''}{formatNumber(r.quantity, 1)}{r.unit}
                </td>
                <td className="border border-gray-800 p-1.5">{r.memo ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 확인란 */}
        <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
          <SignBox label="작성자" />
          <SignBox label="확인자" />
          <SignBox label="대표자" />
        </div>

        <div className="mt-6 text-[10px] text-gray-500 text-center">
          본 보고서는 OMWIS 에서 자동 생성되었습니다 — 출력 일시: {formatDate(generatedAt)}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-gray-300 p-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-base font-bold mt-0.5 ${color ?? 'text-gray-800'}`}>{value}</div>
    </div>
  );
}

function SignBox({ label }: { label: string }) {
  return (
    <div className="border border-gray-800">
      <div className="bg-gray-100 px-2 py-1 border-b border-gray-800 text-center font-semibold">
        {label}
      </div>
      <div className="h-16 flex items-end justify-end px-2 pb-1 text-gray-400">(인)</div>
    </div>
  );
}
