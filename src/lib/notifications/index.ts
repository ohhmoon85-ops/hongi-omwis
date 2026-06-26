// ============================================================================
// 알림 이벤트 디스패처 — 비즈니스 이벤트를 채널별 발송으로 변환
// ============================================================================

import { sendKakaoAlimtalk } from './kakao';
import { sendEmail } from './email';
import { KAKAO_TEMPLATES, renderTemplate, missingVariables } from './kakao-templates';

export type NotificationEvent =
  | 'order_created'      // 거래처 주문 접수 → 관리자
  | 'order_approved'     // 관리자 승인 → 거래처
  | 'order_rejected'     // 관리자 거절 → 거래처
  | 'delivery_depart'    // 배송 출발 → 거래처
  | 'delivery_done'      // 배송 완료 → 거래처
  | 'stock_alert'        // 안전재고 미달 → 관리자
  | 'acis_buy_signal'    // ACIS BUY 신호 → 관리자
  | 'credit_exceeded'    // 신용 한도 초과 → 관리자
  | 'weekly_summary';    // 주간 요약 → 회장

export interface DispatchParams {
  event: NotificationEvent;
  to: { phone?: string; email?: string };
  variables: Record<string, string | number>;
}

interface EventConfig {
  channel: 'kakao' | 'email' | 'both';
  templateCode?: string; // 알림톡 문구는 KAKAO_TEMPLATES[templateCode] 가 단일 소스
  subject?: (v: Record<string, string | number>) => string;
  body?: (v: Record<string, string | number>) => string;
}

const EVENT_CONFIG: Record<NotificationEvent, EventConfig> = {
  order_created: {
    channel: 'both',
    templateCode: 'ORDER_CREATED',
    subject: (v) => `[OMWIS] 신규 주문 — ${v.company_name} / ${v.item_summary}`,
    body: (v) => `
      <h2>신규 주문 접수</h2>
      <p>거래처: <b>${v.company_name}</b></p>
      <p>품목: ${v.item_summary}</p>
      <p>납기 요청일: ${v.requested_date}</p>
      <p>총 금액: ${v.total_amount}원</p>
      <p>주문번호: ${v.order_number}</p>
    `,
  },
  order_approved: {
    channel: 'both',
    templateCode: 'ORDER_APPROVED',
    subject: (v) => `[(주)홍지] 주문 ${v.order_number} 승인 완료`,
    body: (v) => `<p>주문 ${v.order_number} 이(가) 승인되었습니다. 예상 납기: ${v.confirmed_date}</p>`,
  },
  order_rejected: {
    channel: 'both',
    templateCode: 'ORDER_REJECTED',
    subject: (v) => `[(주)홍지] 주문 ${v.order_number} 처리 안내`,
    body: (v) => `<p>주문 ${v.order_number} 이(가) 다음 사유로 처리되지 못했습니다: ${v.reason}</p>`,
  },
  delivery_depart: {
    channel: 'kakao',
    templateCode: 'DELIVERY_DEPART',
  },
  delivery_done: {
    channel: 'both',
    templateCode: 'DELIVERY_DONE',
    subject: (v) => `[(주)홍지] 주문 ${v.order_number} 배송 완료`,
    body: (v) => `<p>주문 ${v.order_number} 이(가) ${v.completed_at} 에 배송 완료되었습니다.</p>`,
  },
  stock_alert: {
    channel: 'kakao',
    templateCode: 'STOCK_ALERT',
  },
  acis_buy_signal: {
    channel: 'email',
    subject: (v) => `[ACIS] BUY 신호 — SPI ${v.spi} / ERI ${v.eri}`,
    body: (v) => `<p>알루미늄 구매 시점 — 권고 발주량: ${v.recommendation}</p>`,
  },
  credit_exceeded: {
    channel: 'email',
    subject: (v) => `[OMWIS] ${v.company_name} 신용 한도 초과`,
    body: (v) => `<p>거래처 ${v.company_name} 의 미수금이 한도를 ${v.over_amount}원 초과했습니다.</p>`,
  },
  weekly_summary: {
    channel: 'both',
    templateCode: 'WEEKLY_SUMMARY',
    subject: (v) => `[(주)홍지] 주간 경영 요약 (${v.period})`,
    body: (v) => `<p>${v.summary_html}</p>`,
  },
};

export async function dispatchNotification(params: DispatchParams) {
  const cfg = EVENT_CONFIG[params.event];
  if (!cfg) {
    console.warn('[NOTIFY] unknown event:', params.event);
    return;
  }

  const tasks: Promise<unknown>[] = [];

  if ((cfg.channel === 'kakao' || cfg.channel === 'both') && params.to.phone && cfg.templateCode) {
    const tpl = KAKAO_TEMPLATES[cfg.templateCode];
    if (!tpl) {
      console.warn('[NOTIFY] 알림톡 템플릿 미정의:', cfg.templateCode);
    } else {
      const missing = missingVariables(tpl, params.variables);
      if (missing.length) {
        console.warn(`[NOTIFY] ${tpl.code} 변수 누락 → 발송 생략:`, missing);
      } else {
        tasks.push(sendKakaoAlimtalk({
          to: params.to.phone,
          templateCode: tpl.code,
          message: renderTemplate(tpl, params.variables),
          buttons: tpl.buttons,
          variables: params.variables,
        }));
      }
    }
  }

  if ((cfg.channel === 'email' || cfg.channel === 'both') && params.to.email && cfg.subject && cfg.body) {
    tasks.push(sendEmail({
      to: params.to.email,
      subject: cfg.subject(params.variables),
      html: cfg.body(params.variables),
    }));
  }

  await Promise.allSettled(tasks);
}
