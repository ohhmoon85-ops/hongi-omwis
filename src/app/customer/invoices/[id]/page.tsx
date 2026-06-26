// ============================================================================
// /customer/invoices/[id] — 거래처 본인 세금계산서 PDF 인쇄
// /admin/invoices/[id] 와 동일한 양식. 거래처 RLS (cust_read_own_invoices)
// 가 본인 invoice 만 노출 — 다른 거래처 invoice 는 .single() 에서 null 반환.
// ============================================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SUPPLIER } from '@/lib/company';
import { formatKRW, formatDate } from '@/lib/utils';
import InvoicePrintActions from '@/components/admin/InvoicePrintActions';

interface PageProps { params: { id: string } }

interface InvoiceItem {
  name: string;
  quantity: number;
  unit_price: number;
  supply: number;
  tax: number;
}

async function loadInvoice(id: string) {
  // 거래처 권한으로 조회 — RLS 가 본인 인보이스만 노출
  const supabase = createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, order_id, mgt_key, nts_confirm_number, supply_amount, tax_amount, total_amount, status, issue_date, is_mock')
    .eq('id', id)
    .maybeSingle();
  if (!invoice) return null;

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, requested_date, confirmed_date, memo, customer_id')
    .eq('id', invoice.order_id)
    .single();
  if (!order) return null;

  const { data: customer } = await supabase
    .from('customers')
    .select('company_name, business_number, ceo_name, biz_type, biz_item, address, tax_email, email')
    .eq('id', order.customer_id)
    .single();

  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, unit_price, subtotal, products(name)')
    .eq('order_id', order.id);

  const lines: InvoiceItem[] = (items ?? []).map((it) => {
    const supply = Math.round(it.subtotal ?? 0);
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: ((it as any).products?.name ?? '품목') as string,
      quantity: Number(it.quantity),
      unit_price: it.unit_price,
      supply,
      tax: Math.round(supply * 0.1),
    };
  });

  return { invoice, order, customer, lines };
}

// 숫자 → 한글 금액 (admin 양식과 동일)
function toKoreanAmount(n: number): string {
  const units = ['', '만', '억', '조'];
  const digits = ['영','일','이','삼','사','오','육','칠','팔','구'];
  if (n === 0) return '영원';
  const groups: string[] = [];
  let v = Math.abs(Math.floor(n));
  let i = 0;
  while (v > 0) {
    const g = v % 10000;
    if (g > 0) {
      let s = '';
      const thousand = Math.floor(g / 1000);
      const hundred  = Math.floor((g % 1000) / 100);
      const ten      = Math.floor((g % 100) / 10);
      const one      = g % 10;
      if (thousand) s += (thousand === 1 ? '' : digits[thousand]) + '천';
      if (hundred)  s += (hundred === 1 ? '' : digits[hundred]) + '백';
      if (ten)      s += (ten === 1 ? '' : digits[ten]) + '십';
      if (one)      s += digits[one];
      groups.unshift(s + units[i]);
    }
    v = Math.floor(v / 10000);
    i++;
  }
  return groups.join('') + '원';
}

export default async function CustomerInvoicePrintPage({ params }: PageProps) {
  const data = await loadInvoice(params.id);
  if (!data) notFound();
  const { invoice, order, customer, lines } = data;

  const issueDate = invoice.issue_date ?? formatDate(new Date());

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
        }
      ` }} />

      <div className="no-print bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between">
          <div>
            <Link href="/customer/documents" className="text-xs text-gray-500 hover:text-gray-800">
              ← 세금계산서 목록
            </Link>
            <h1 className="text-xl font-bold text-gray-900 mt-1">
              전자세금계산서 — {order.order_number}
              {invoice.is_mock && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  데모(미발행)
                </span>
              )}
            </h1>
          </div>
          <InvoicePrintActions />
        </div>
      </div>

      <div
        className="bg-white text-[#111] mx-auto my-8 shadow-lg"
        style={{ width: '210mm', minHeight: '297mm', padding: '14mm' }}
      >
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold tracking-widest">전 자 세 금 계 산 서</h2>
          <div className="text-xs text-gray-600 mt-1">(공급받는자 보관용)</div>
        </div>

        <div className="flex justify-between text-xs mb-3">
          <div>
            <span className="font-semibold">관리번호:</span> {invoice.mgt_key}
          </div>
          <div>
            <span className="font-semibold">승인번호:</span>{' '}
            {invoice.nts_confirm_number ?? <span className="text-gray-400">미승인 (데모)</span>}
          </div>
          <div>
            <span className="font-semibold">작성일자:</span> {formatDate(issueDate)}
          </div>
        </div>

        <table className="w-full border-collapse border border-gray-800 text-xs">
          <thead>
            <tr>
              <th className="border border-gray-800 bg-gray-100 p-2 w-12 text-center" rowSpan={5}>공급자</th>
              <th className="border border-gray-800 bg-gray-50 p-1.5 w-24">등록번호</th>
              <td className="border border-gray-800 p-1.5" colSpan={3}>{SUPPLIER.bizNumber}</td>
              <th className="border border-gray-800 bg-gray-100 p-2 w-12 text-center" rowSpan={5}>공<br/>급<br/>받<br/>는<br/>자</th>
              <th className="border border-gray-800 bg-gray-50 p-1.5 w-24">등록번호</th>
              <td className="border border-gray-800 p-1.5" colSpan={2}>{customer?.business_number ?? '-'}</td>
            </tr>
            <tr>
              <th className="border border-gray-800 bg-gray-50 p-1.5">상호(법인명)</th>
              <td className="border border-gray-800 p-1.5">{SUPPLIER.name}</td>
              <th className="border border-gray-800 bg-gray-50 p-1.5">대표자</th>
              <td className="border border-gray-800 p-1.5">{SUPPLIER.ceo}</td>
              <th className="border border-gray-800 bg-gray-50 p-1.5">상호(법인명)</th>
              <td className="border border-gray-800 p-1.5">{customer?.company_name ?? '-'}</td>
              <td className="border border-gray-800 p-1.5">
                <span className="text-[10px] text-gray-500">대표자 </span>{customer?.ceo_name ?? '-'}
              </td>
            </tr>
            <tr>
              <th className="border border-gray-800 bg-gray-50 p-1.5">사업장 주소</th>
              <td className="border border-gray-800 p-1.5" colSpan={3}>{SUPPLIER.address || '-'}</td>
              <th className="border border-gray-800 bg-gray-50 p-1.5">사업장 주소</th>
              <td className="border border-gray-800 p-1.5" colSpan={2}>{customer?.address ?? '-'}</td>
            </tr>
            <tr>
              <th className="border border-gray-800 bg-gray-50 p-1.5">업태</th>
              <td className="border border-gray-800 p-1.5">{SUPPLIER.bizType}</td>
              <th className="border border-gray-800 bg-gray-50 p-1.5">종목</th>
              <td className="border border-gray-800 p-1.5">{SUPPLIER.bizItem}</td>
              <th className="border border-gray-800 bg-gray-50 p-1.5">업태/종목</th>
              <td className="border border-gray-800 p-1.5" colSpan={2}>
                {customer?.biz_type ?? '-'} / {customer?.biz_item ?? '-'}
              </td>
            </tr>
            <tr>
              <th className="border border-gray-800 bg-gray-50 p-1.5">이메일</th>
              <td className="border border-gray-800 p-1.5" colSpan={3}>{SUPPLIER.email}</td>
              <th className="border border-gray-800 bg-gray-50 p-1.5">이메일</th>
              <td className="border border-gray-800 p-1.5" colSpan={2}>
                {customer?.tax_email ?? customer?.email ?? '-'}
              </td>
            </tr>
          </thead>
        </table>

        <table className="w-full border-collapse border border-gray-800 text-xs mt-3">
          <tbody>
            <tr>
              <th className="border border-gray-800 bg-gray-100 p-2 w-20">합계금액</th>
              <td className="border border-gray-800 p-2 text-center font-bold">
                {toKoreanAmount(invoice.total_amount)}
                <span className="ml-3 text-gray-500">({formatKRW(invoice.total_amount)})</span>
              </td>
              <th className="border border-gray-800 bg-gray-100 p-2 w-20">공급가액</th>
              <td className="border border-gray-800 p-2 text-right">{formatKRW(invoice.supply_amount)}</td>
              <th className="border border-gray-800 bg-gray-100 p-2 w-16">세액</th>
              <td className="border border-gray-800 p-2 text-right">{formatKRW(invoice.tax_amount)}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-gray-800 text-xs mt-3">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 p-1.5 w-10">월/일</th>
              <th className="border border-gray-800 p-1.5">품목</th>
              <th className="border border-gray-800 p-1.5 w-16">수량</th>
              <th className="border border-gray-800 p-1.5 w-24">단가</th>
              <th className="border border-gray-800 p-1.5 w-28">공급가액</th>
              <th className="border border-gray-800 p-1.5 w-24">세액</th>
              <th className="border border-gray-800 p-1.5">비고</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((it, i) => (
              <tr key={i}>
                <td className="border border-gray-800 p-1.5 text-center">{issueDate.slice(5).replace('-', '/')}</td>
                <td className="border border-gray-800 p-1.5">{it.name}</td>
                <td className="border border-gray-800 p-1.5 text-right">{it.quantity}kg</td>
                <td className="border border-gray-800 p-1.5 text-right">{formatKRW(it.unit_price)}</td>
                <td className="border border-gray-800 p-1.5 text-right">{formatKRW(it.supply)}</td>
                <td className="border border-gray-800 p-1.5 text-right">{formatKRW(it.tax)}</td>
                <td className="border border-gray-800 p-1.5"></td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 5 - lines.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td className="border border-gray-800 p-3"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {order.memo && (
          <div className="text-xs mt-3 px-3 py-2 border border-gray-300 bg-gray-50">
            <b>비고:</b> {order.memo}
          </div>
        )}

        <div className="flex justify-end mt-6 text-xs text-gray-500">
          <div>
            본 전자세금계산서는 OMWIS에서 자동 발행되었습니다.
            {invoice.is_mock && ' (데모 — 국세청 미전송)'}
          </div>
        </div>
      </div>
    </>
  );
}
