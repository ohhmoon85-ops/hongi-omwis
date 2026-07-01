// ============================================================================
// 공급자(자사) 사업자정보 + 부가세 계산
// 사업자정보는 env 로 주입 (미설정 시 데모 기본값 — 실발행 전 반드시 채울 것)
// ============================================================================

export const SUPPLIER = {
  bizNumber: process.env.SUPPLIER_BIZ_NUMBER ?? '000-00-00000',
  name:      process.env.SUPPLIER_NAME       ?? '(주)홍지',
  ceo:       process.env.SUPPLIER_CEO        ?? '변지수',
  address:   process.env.SUPPLIER_ADDRESS    ?? '',
  bizType:   process.env.SUPPLIER_BIZ_TYPE   ?? '제조',
  bizItem:   process.env.SUPPLIER_BIZ_ITEM   ?? '알루미늄',
  email:     process.env.SUPPLIER_EMAIL      ?? 'tax@hongjee.co.kr',
} as const;

// 자사 사업자번호가 실제 값으로 채워졌는지 (실발행 전제조건 중 하나)
export function isSupplierConfigured(): boolean {
  return SUPPLIER.bizNumber !== '000-00-00000' && SUPPLIER.bizNumber.length > 0;
}

export const VAT_RATE = 0.1;

// 공급가액 기준(부가세 별도) → 세액·합계 계산
export function calcVat(supplyAmount: number): {
  supply: number;
  tax: number;
  total: number;
} {
  const supply = Math.round(supplyAmount);
  const tax = Math.round(supply * VAT_RATE);
  return { supply, tax, total: supply + tax };
}
