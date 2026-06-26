// ============================================================================
// 전자세금계산서 발행 — 팝빌(Popbill) 게이트웨이
// POPBILL 키 + 자사 사업자번호 미설정 시 콘솔 Mock (개발/키 미보유)
// ----------------------------------------------------------------------------
// 실연동 시 popbill 패키지의 Taxinvoice.registIssue(corpNum, mgtKey, invoice)
// 로 국세청 즉시발행. 여기서는 동일 인터페이스로 Mock 결과 반환.
// ============================================================================

import { SUPPLIER, isSupplierConfigured } from '@/lib/company';

const POPBILL_LINK_ID = process.env.POPBILL_LINK_ID ?? '';
const POPBILL_SECRET  = process.env.POPBILL_SECRET  ?? '';

export interface InvoiceItemLine {
  name: string;
  quantity: number;
  unitPrice: number;
  supply: number;   // 품목 공급가액
  tax: number;      // 품목 세액
}

export interface IssueTaxInvoiceParams {
  mgtKey: string;                         // 발행 관리번호 (주문번호 기반)
  issueDate: string;                      // 작성일자 YYYY-MM-DD
  buyer: {
    bizNumber: string;
    name: string;
    ceo: string;
    address?: string;
    bizType?: string;
    bizItem?: string;
    email?: string;
  };
  items: InvoiceItemLine[];
  supply: number;                         // 합계 공급가액
  tax: number;                            // 합계 세액
  total: number;                          // 합계 금액
}

export interface IssueTaxInvoiceResult {
  success: boolean;
  mock: boolean;
  ntsConfirmNumber?: string;              // 국세청 승인번호
  error?: string;
}

function isPopbillConfigured(): boolean {
  return Boolean(POPBILL_LINK_ID && POPBILL_SECRET && isSupplierConfigured());
}

export async function issueTaxInvoice(
  params: IssueTaxInvoiceParams,
): Promise<IssueTaxInvoiceResult> {
  // ─── Mock 모드 ─────────────────────────────────────────────────────────
  if (!isPopbillConfigured()) {
    console.log(
      '[POPBILL MOCK] 세금계산서 발행',
      `\n  관리번호: ${params.mgtKey}`,
      `\n  공급자: ${SUPPLIER.name} (${SUPPLIER.bizNumber})`,
      `\n  공급받는자: ${params.buyer.name} (${params.buyer.bizNumber})`,
      `\n  공급가액 ${params.supply.toLocaleString()} / 세액 ${params.tax.toLocaleString()} / 합계 ${params.total.toLocaleString()}`,
    );
    return { success: true, mock: true, ntsConfirmNumber: `MOCK-${params.mgtKey}` };
  }

  // ─── 실발행 (팝빌) ─────────────────────────────────────────────────────
  // TODO: popbill SDK 연동
  //   const popbill = require('popbill');
  //   popbill.config({ LinkID: POPBILL_LINK_ID, SecretKey: POPBILL_SECRET, ... });
  //   const ti = popbill.TaxinvoiceService();
  //   await ti.registIssue(SUPPLIER.bizNumber.replace(/-/g,''), params.mgtKey, {...});
  try {
    console.log('[POPBILL] 실발행 미구현 — Mock 처리', params.mgtKey);
    return { success: true, mock: true, ntsConfirmNumber: `MOCK-${params.mgtKey}` };
  } catch (err) {
    return {
      success: false,
      mock: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
