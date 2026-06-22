// ============================================================================
// 카카오 알림톡 발송 — KAKAO_API_KEY 미설정 시 콘솔 Mock 동작
// ============================================================================

const KAKAO_API_KEY    = process.env.KAKAO_API_KEY    ?? '';
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY ?? '';

export interface KakaoAlimtalkParams {
  to: string;                              // 수신자 전화번호 (010-xxxx-xxxx)
  templateCode: string;                    // 사전 등록된 알림톡 템플릿 코드
  variables: Record<string, string | number>;
  fallbackSms?: boolean;                   // 알림톡 실패 시 SMS 대체
}

export interface KakaoSendResult {
  success: boolean;
  mock: boolean;
  messageId?: string;
  error?: string;
}

export async function sendKakaoAlimtalk(
  params: KakaoAlimtalkParams,
): Promise<KakaoSendResult> {
  // ─── Mock 모드 ─────────────────────────────────────────────────────────
  if (!KAKAO_API_KEY || !KAKAO_SENDER_KEY) {
    console.log('[KAKAO MOCK] →', params.to, params.templateCode, params.variables);
    return { success: true, mock: true };
  }

  // ─── 실제 발송 (Phase 2 후반에 실 API 연동) ──────────────────────────
  // TODO: 카카오 비즈메시지 또는 알리고/네이버클라우드 등 게이트웨이 호출
  // 예시 (알리고 API):
  // const res = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', { ... });
  try {
    console.log('[KAKAO] real send not implemented yet, treating as mock', params);
    return { success: true, mock: true };
  } catch (err) {
    return {
      success: false,
      mock: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
