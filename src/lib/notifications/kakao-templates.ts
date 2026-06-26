// ============================================================================
// 카카오 알림톡 템플릿 단일 소스
// ----------------------------------------------------------------------------
// 여기 `text` 가 카카오/알리고 콘솔에 등록할 "심사용 원문"이자 런타임 발송 원본.
// 변수는 카카오 규격 #{변수명} 형식. 등록 원문과 발송 문구가 같은 소스에서
// 나오므로 "등록본 ≠ 발송본" 으로 심사 반려되는 일이 없다.
//   - docs/KAKAO_TEMPLATES.md 는 이 파일로부터 생성한 제출용 문서.
// ============================================================================

export type KakaoLinkType = 'WL' | 'AL' | 'BK' | 'MD'; // 웹링크/앱링크/봇키워드/메시지전달

export interface KakaoButton {
  name: string;                 // 버튼명 (예: 주문 내역)
  linkType: KakaoLinkType;
  linkMo?: string;              // 모바일 웹링크
  linkPc?: string;              // PC 웹링크
}

export interface KakaoTemplate {
  code: string;                 // 알리고/카카오 템플릿 코드
  name: string;                 // 콘솔 표시용 이름
  text: string;                 // #{...} 포함 원문 (등록 = 발송)
  buttons?: KakaoButton[];
  note?: string;                // 심사 메모
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://omwis.hongi.co.kr';

// 거래처용 "주문 내역" 웹링크 버튼
const ordersButton: KakaoButton = {
  name: '주문 내역 보기',
  linkType: 'WL',
  linkMo: `${APP_URL}/customer/orders`,
  linkPc: `${APP_URL}/customer/orders`,
};

// 관리자용 "주문 관리" 웹링크 버튼
const adminOrdersButton: KakaoButton = {
  name: '주문 관리',
  linkType: 'WL',
  linkMo: `${APP_URL}/admin/orders`,
  linkPc: `${APP_URL}/admin/orders`,
};

// 관리자용 "재고 관리" 웹링크 버튼
const adminInventoryButton: KakaoButton = {
  name: '재고 관리',
  linkType: 'WL',
  linkMo: `${APP_URL}/admin/inventory`,
  linkPc: `${APP_URL}/admin/inventory`,
};

// 회장용 "모니터링" 웹링크 버튼
const chairmanMonitorButton: KakaoButton = {
  name: '경영 모니터링',
  linkType: 'WL',
  linkMo: `${APP_URL}/chairman/monitor`,
  linkPc: `${APP_URL}/chairman/monitor`,
};

export const KAKAO_TEMPLATES: Record<string, KakaoTemplate> = {
  ORDER_CREATED: {
    code: 'ORDER_CREATED',
    name: '신규 주문 접수(관리자)',
    text:
      '[OMWIS] 신규 주문 접수\n\n' +
      '거래처: #{company_name}\n' +
      '주문번호: #{order_number}\n' +
      '품목: #{item_summary}\n' +
      '납기 요청일: #{requested_date}\n\n' +
      '주문 관리에서 승인/거절을 진행해 주세요.',
    buttons: [adminOrdersButton],
  },
  ORDER_APPROVED: {
    code: 'ORDER_APPROVED',
    name: '주문 승인(거래처)',
    text:
      '[(주)홍지] 주문 승인 안내\n\n' +
      '주문번호: #{order_number}\n' +
      '주문이 정상 승인되었습니다.\n' +
      '예상 납기일: #{confirmed_date}\n\n' +
      '자세한 내용은 주문 내역에서 확인하실 수 있습니다.',
    buttons: [ordersButton],
  },
  ORDER_REJECTED: {
    code: 'ORDER_REJECTED',
    name: '주문 거절(거래처)',
    text:
      '[(주)홍지] 주문 처리 안내\n\n' +
      '주문번호: #{order_number}\n' +
      '아래 사유로 주문이 처리되지 못했습니다.\n' +
      '사유: #{reason}\n\n' +
      '문의사항은 담당자에게 연락 부탁드립니다.',
    buttons: [ordersButton],
  },
  DELIVERY_DEPART: {
    code: 'DELIVERY_DEPART',
    name: '배송 출발(거래처)',
    text:
      '[(주)홍지] 배송 출발 안내\n\n' +
      '주문번호: #{order_number}\n' +
      '주문하신 상품이 배송 출발하였습니다.\n' +
      '배송지: #{address}',
    buttons: [ordersButton],
  },
  DELIVERY_DONE: {
    code: 'DELIVERY_DONE',
    name: '배송 완료(거래처)',
    text:
      '[(주)홍지] 배송 완료 안내\n\n' +
      '주문번호: #{order_number}\n' +
      '주문하신 상품이 배송 완료되었습니다.\n' +
      '이용해 주셔서 감사합니다.',
    buttons: [ordersButton],
  },
  STOCK_ALERT: {
    code: 'STOCK_ALERT',
    name: '안전재고 미달(관리자)',
    text:
      '[OMWIS] 안전재고 경보\n\n' +
      '품목: #{product_name}\n' +
      '현재 재고: #{current_quantity}\n' +
      '안전재고 기준: #{min_quantity}\n' +
      '소진 예상일: #{depletes_at}\n\n' +
      'ACIS 신호와 함께 발주 여부를 검토해 주세요.',
    buttons: [adminInventoryButton],
  },
  WEEKLY_SUMMARY: {
    code: 'WEEKLY_SUMMARY',
    name: '주간 경영 요약(회장)',
    text:
      '[(주)홍지] 주간 경영 요약 (#{period})\n\n' +
      '신규 주문: #{order_count}건 / 매출 #{revenue}원\n' +
      '진행 중 배송: #{shipping_count}건\n' +
      '미수금: #{receivable}원\n' +
      '재고 경보: #{low_stock_count}건\n\n' +
      '상세 내역은 모니터링 대시보드에서 확인해 주세요.',
    buttons: [chairmanMonitorButton],
  },
};

// #{변수} 치환 → 최종 발송 문구. 누락 변수는 그대로 남겨 추적 가능.
export function renderTemplate(
  tpl: KakaoTemplate,
  variables: Record<string, string | number>,
): string {
  return tpl.text.replace(/#\{(\w+)\}/g, (_, key: string) =>
    variables[key] != null ? String(variables[key]) : `#{${key}}`,
  );
}

// 템플릿이 요구하는 변수 목록 (#{...}) 추출
export function templateVariables(tpl: KakaoTemplate): string[] {
  const re = /#\{(\w+)\}/g;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl.text)) !== null) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

// 발송 전 누락 변수 검사 — 등록본과 발송본 불일치(심사 위반) 예방
export function missingVariables(
  tpl: KakaoTemplate,
  variables: Record<string, string | number>,
): string[] {
  return templateVariables(tpl).filter((k) => variables[k] == null);
}
