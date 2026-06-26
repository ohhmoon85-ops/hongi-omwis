// ============================================================================
// 알림 이벤트 디스패처 — 비즈니스 이벤트를 채널별 발송으로 변환
// ============================================================================

import { sendKakaoAlimtalk } from './kakao';
import { sendEmail } from './email';
import { KAKAO_TEMPLATES, renderTemplate, missingVariables } from './kakao-templates';
import { createAdminClient } from '@/lib/supabase/server';

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
    // summary_html 은 cron 라우트에서 완성된 HTML 문서를 전달 — 추가 래핑 불필요
    body: (v) => String(v.summary_html ?? ''),
  },
};

// 발송 결과를 notifications 테이블에 audit log 로 저장 (서비스 키)
// 호출 컨텍스트가 서버여야만 동작 — 클라이언트에서 호출되면 fail silently
async function logNotification(
  event: NotificationEvent,
  channel: 'kakao' | 'email',
  recipientType: 'chairman' | 'admin' | 'customer' | null,
  to: string,
  message: string,
  status: 'sent' | 'failed',
  mock: boolean,
) {
  try {
    const admin = createAdminClient();
    await admin.from('notifications').insert({
      type: event,
      recipient_type: recipientType,
      recipient_id: null,
      channel,
      message: `[${to}] ${mock ? '(MOCK) ' : ''}${message.slice(0, 500)}`,
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
  } catch (err) {
    // 클라이언트 컨텍스트(서비스 키 없음) 거나 RLS 차단 시 silent — 발송 자체는 영향 없음
    console.warn('[NOTIFY audit] log skipped:', err instanceof Error ? err.message : err);
  }
}

// 이벤트 → 기본 수신자 유형 추론 (audit log 분류용)
function recipientTypeFor(event: NotificationEvent): 'chairman' | 'admin' | 'customer' | null {
  switch (event) {
    case 'order_created':
    case 'stock_alert':
    case 'acis_buy_signal':
    case 'credit_exceeded':
      return 'admin';
    case 'order_approved':
    case 'order_rejected':
    case 'delivery_depart':
    case 'delivery_done':
      return 'customer';
    case 'weekly_summary':
      return 'chairman';
    default:
      return null;
  }
}

export async function dispatchNotification(params: DispatchParams) {
  const cfg = EVENT_CONFIG[params.event];
  if (!cfg) {
    console.warn('[NOTIFY] unknown event:', params.event);
    return;
  }
  const recipientType = recipientTypeFor(params.event);

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
        const message = renderTemplate(tpl, params.variables);
        tasks.push(
          sendKakaoAlimtalk({
            to: params.to.phone, templateCode: tpl.code, message,
            buttons: tpl.buttons, variables: params.variables,
          }).then((r) =>
            logNotification(params.event, 'kakao', recipientType, params.to.phone!,
              message, r.success ? 'sent' : 'failed', r.mock),
          ),
        );
      }
    }
  }

  if ((cfg.channel === 'email' || cfg.channel === 'both') && params.to.email && cfg.subject && cfg.body) {
    const subject = cfg.subject(params.variables);
    const html = cfg.body(params.variables);
    tasks.push(
      sendEmail({ to: params.to.email, subject, html })
        .then((r) =>
          logNotification(params.event, 'email', recipientType, params.to.email!,
            subject, r.success ? 'sent' : 'failed', r.mock),
        ),
    );
  }

  await Promise.allSettled(tasks);
}
