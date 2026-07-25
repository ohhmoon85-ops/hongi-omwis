// ============================================================================
// 공급자(자사) 사업자정보 + 부가세 계산
// ----------------------------------------------------------------------------
// (주)홍지 사업자등록증 (파주세무서 · 2016.01.28 정정) 기준.
// env 오버라이드 우선 — 실서비스에선 Vercel Environment Variables 로 관리하며,
// env 미설정 시 아래 등록증 실값을 기본값으로 사용한다.
//
// ⚠️ 대표자 = 김관수 (법인 대표). 시스템 super_admin 은 변지수 — 별개 개념이니
// 로그인·권한 관련 문구의 "변지수" 는 그대로 두고, 이 파일의 ceo 는 등록증 값 사용.
// ============================================================================

export const SUPPLIER = {
  bizNumber:  process.env.SUPPLIER_BIZ_NUMBER  ?? '201-81-79147',
  corpNumber: process.env.SUPPLIER_CORP_NUMBER ?? '110111-2683608',
  name:       process.env.SUPPLIER_NAME        ?? '(주)홍지',
  ceo:        process.env.SUPPLIER_CEO         ?? '김관수',
  address:    process.env.SUPPLIER_ADDRESS     ?? '경기도 파주시 오도로 58, 외1필지(오도로 56)(오도동)',
  bizType:    process.env.SUPPLIER_BIZ_TYPE    ?? '제조',
  bizItem:    process.env.SUPPLIER_BIZ_ITEM    ?? '기타금속판재가공업',
  email:      process.env.SUPPLIER_EMAIL       ?? 'hongjeeart@nate.com',
  tel:        process.env.SUPPLIER_TEL         ?? '031-957-5038',
  fax:        process.env.SUPPLIER_FAX         ?? '031-957-5071',
  foundedAt:  process.env.SUPPLIER_FOUNDED_AT  ?? '2003-01-01',
} as const;

// 자사 사업자번호가 실 사업자번호로 채워졌는지 (실발행 전제조건)
export function isSupplierConfigured(): boolean {
  const n = SUPPLIER.bizNumber;
  return n.length > 0 && n !== '000-00-00000';
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
