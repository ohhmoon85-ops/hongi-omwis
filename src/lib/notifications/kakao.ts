// ============================================================================
// 카카오 알림톡 발송 — 알리고(Aligo) 게이트웨이
// 필수 env 미설정 시 콘솔 Mock 동작 (개발/키 미보유 환경)
// ----------------------------------------------------------------------------
// 사전 준비(코드 밖):
//  ① 카카오 비즈니스 채널 + 알리고 발신프로필(senderkey)
//  ② 알림톡 템플릿 사전 심사 등록 (templateCode 와 message 문구가 일치해야 함)
// ============================================================================

const KAKAO_API_KEY    = process.env.KAKAO_API_KEY    ?? ''; // 알리고 apikey
const KAKAO_USER_ID    = process.env.KAKAO_USER_ID    ?? ''; // 알리고 계정 ID
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY ?? ''; // 발신프로필 키
const KAKAO_SENDER     = process.env.KAKAO_SENDER     ?? ''; // 발신 번호 (등록된 번호)

import type { KakaoButton, KakaoLinkType } from './kakao-templates';

const ALIGO_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';

// 알리고 button_1 JSON 직렬화용 linkType → 한글 명칭 매핑
const LINK_TYPE_NAME: Record<KakaoLinkType, string> = {
  WL: '웹링크',
  AL: '앱링크',
  BK: '봇키워드',
  MD: '메시지전달',
};

export interface KakaoAlimtalkParams {
  to: string;                              // 수신자 전화번호 (010-xxxx-xxxx)
  templateCode: string;                    // 사전 등록된 알림톡 템플릿 코드
  message: string;                         // 템플릿과 일치하는 최종 발송 문구(변수 치환 완료)
  buttons?: KakaoButton[];                 // 알림톡 버튼 (등록 템플릿과 일치해야 함)
  variables?: Record<string, string | number>; // 로깅/디버그용
  fallbackSms?: string;                    // 알림톡 실패 시 대체 SMS 문구
}

// 알리고 규격 button_1 JSON 문자열 생성
function buildButtonParam(buttons: KakaoButton[]): string {
  return JSON.stringify({
    button: buttons.map((b) => ({
      name: b.name,
      linkType: b.linkType,
      linkTypeName: LINK_TYPE_NAME[b.linkType],
      ...(b.linkMo ? { linkMo: b.linkMo } : {}),
      ...(b.linkPc ? { linkPc: b.linkPc } : {}),
    })),
  });
}

export interface KakaoSendResult {
  success: boolean;
  mock: boolean;
  messageId?: string;
  error?: string;
}

function isConfigured(): boolean {
  return Boolean(KAKAO_API_KEY && KAKAO_USER_ID && KAKAO_SENDER_KEY && KAKAO_SENDER);
}

export async function sendKakaoAlimtalk(
  params: KakaoAlimtalkParams,
): Promise<KakaoSendResult> {
  // ─── Mock 모드 (키 미설정) ──────────────────────────────────────────────
  if (!isConfigured()) {
    console.log(
      '[KAKAO MOCK] →', params.to, params.templateCode,
      '\n' + params.message,
      params.buttons?.length ? `\n[버튼] ${params.buttons.map((b) => b.name).join(', ')}` : '',
    );
    return { success: true, mock: true };
  }

  // ─── 실제 발송 (알리고 알림톡) ──────────────────────────────────────────
  // 알리고는 application/x-www-form-urlencoded 폼 전송, 수신자 인덱스는 _1 부터.
  try {
    const form = new URLSearchParams({
      apikey: KAKAO_API_KEY,
      userid: KAKAO_USER_ID,
      senderkey: KAKAO_SENDER_KEY,
      tpl_code: params.templateCode,
      sender: KAKAO_SENDER,
      receiver_1: params.to.replace(/-/g, ''),
      subject_1: params.templateCode,
      message_1: params.message,
    });

    // 버튼 (등록 템플릿과 일치해야 발송됨)
    if (params.buttons?.length) {
      form.set('button_1', buildButtonParam(params.buttons));
    }

    // 알림톡 실패 시 SMS 대체 (선택)
    if (params.fallbackSms) {
      form.set('failover', 'Y');
      form.set('fsubject_1', '[홍지] 배송 안내');
      form.set('fmessage_1', params.fallbackSms);
    }

    const res = await fetch(ALIGO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json()) as { code?: number; message?: string; info?: { mid?: number } };

    // 알리고 성공 코드는 0
    if (data.code !== 0) {
      console.error('[KAKAO] aligo error:', data.code, data.message);
      return { success: false, mock: false, error: data.message ?? `code ${data.code}` };
    }

    return { success: true, mock: false, messageId: data.info?.mid?.toString() };
  } catch (err) {
    console.error('[KAKAO] send failed:', err);
    return {
      success: false,
      mock: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
