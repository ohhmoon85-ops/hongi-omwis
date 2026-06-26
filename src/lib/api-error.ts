// ============================================================================
// API 에러 응답 표준화
// ----------------------------------------------------------------------------
// 모든 API 라우트가 같은 모양의 에러를 반환하도록 통일.
// 클라이언트(toast/UI)는 { error, code } 만 읽으면 됨.
// ============================================================================

import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'unauthorized'        // 401 — 로그인 안 됨
  | 'forbidden'           // 403 — 권한 부족
  | 'not_found'           // 404 — 리소스 없음
  | 'validation'          // 400 — 입력 오류
  | 'conflict'            // 409 — 중복/상태 충돌
  | 'rate_limit'          // 429 — 호출 제한
  | 'integration'         // 502 — 외부 API 오류
  | 'internal';           // 500 — 기타

const STATUS_MAP: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden:    403,
  not_found:    404,
  validation:   400,
  conflict:     409,
  rate_limit:   429,
  integration:  502,
  internal:     500,
};

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  unauthorized: '로그인이 필요합니다.',
  forbidden:    '이 작업을 수행할 권한이 없습니다.',
  not_found:    '요청한 리소스를 찾을 수 없습니다.',
  validation:   '입력 값을 확인해주세요.',
  conflict:     '이미 처리된 요청입니다.',
  rate_limit:   '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.',
  integration:  '외부 시스템 연동 중 오류가 발생했습니다.',
  internal:     '서버 처리 중 오류가 발생했습니다.',
};

export interface ApiErrorBody {
  error: string;         // 사람이 읽는 메시지 (Korean)
  code: ApiErrorCode;    // 클라이언트 분기용 코드
  detail?: unknown;      // 옵션: 추가 디버그 정보 (개발 모드만 채움)
}

export function apiError(
  code: ApiErrorCode,
  message?: string,
  detail?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: message ?? DEFAULT_MESSAGE[code],
    code,
  };
  if (detail !== undefined && process.env.NODE_ENV !== 'production') {
    body.detail = detail;
  }
  return NextResponse.json(body, { status: STATUS_MAP[code] });
}

// 클라이언트에서 API 응답을 토스트로 띄울 때 쓸 메시지 추출
export async function readApiError(res: Response): Promise<string> {
  try {
    const body = await res.json() as Partial<ApiErrorBody>;
    return body.error ?? `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}
