// ============================================================================
// /api/cards/ocr — 명함 AI 인식 (선택 기능)
// ----------------------------------------------------------------------------
// 원칙 ③: AI 는 "있으면 편하고 없어도 되는" 옵션.
//   · GET  → { enabled }  : 서버에 ANTHROPIC_API_KEY 가 있을 때만 true
//   · POST → 명함 이미지(base64)를 Claude 비전으로 읽어 필드 추출 (JSON)
// 자동 저장 아님 — 사람이 확인 후 [업체로 등록] 을 눌러야 저장됨.
// SDK 미설치 → Anthropic Messages REST API 를 fetch 로 직접 호출.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

// 명함 인식 모델 — 기본 최신 Opus, 필요시 env 로 교체(비용/속도 조정)
const OCR_MODEL = process.env.CARD_OCR_MODEL || 'claude-opus-4-8';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const PROMPT = [
  '이 이미지는 명함입니다(중국어일 수 있음). 아래 항목을 추출해 JSON 하나만 출력하세요.',
  '설명·코드블록 없이 순수 JSON 만. 못 읽은 항목은 null.',
  '{',
  '  "company": 회사명(원문 그대로),',
  '  "contact_name": 담당자 이름,',
  '  "title": 직함,',
  '  "phone": 전화/휴대폰,',
  '  "wechat": WeChat ID,',
  '  "email": 이메일,',
  '  "address": 주소',
  '}',
  '회사명에 한자가 있으면 원문 유지하고, 한국어 독음이 명확하면 병기하세요.',
].join('\n');

/** AI 인식 사용 가능 여부 — 클라이언트가 버튼 노출 판단에 사용 */
export async function GET() {
  return NextResponse.json({ enabled: !!process.env.ANTHROPIC_API_KEY });
}

interface OcrBody { image_base64?: string; media_type?: string }

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return apiError('validation', 'AI 인식이 설정되지 않았습니다 (선택 기능)');

  // 권한 확인 (dev 모드는 우회)
  if (!isDevMode) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('unauthorized');
    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return apiError('forbidden', '관리자만 사용할 수 있습니다');
    }
  }

  const body = (await req.json()) as OcrBody;
  const data = (body.image_base64 || '').replace(/^data:[^,]+,/, ''); // dataURL 접두어 제거
  if (!data) return apiError('validation', '이미지가 필요합니다');
  const mediaType = body.media_type || 'image/jpeg';

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });
  } catch (e) {
    return apiError('integration', 'AI 서비스에 연결하지 못했습니다', e instanceof Error ? e.message : undefined);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return apiError('integration', 'AI 인식 실패', detail.slice(0, 300));
  }

  const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (payload.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

  const parsed = safeParseJson(text);
  if (!parsed) return apiError('integration', 'AI 응답을 해석하지 못했습니다');

  // CardOcrResult 형태로 정규화 (모든 키 보장, 문자열 아니면 null)
  const norm = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return NextResponse.json({
    company: norm(parsed.company),
    contact_name: norm(parsed.contact_name),
    title: norm(parsed.title),
    phone: norm(parsed.phone),
    wechat: norm(parsed.wechat),
    email: norm(parsed.email),
    address: norm(parsed.address),
  });
}

/** 모델이 앞뒤에 군말을 붙여도 첫 { … } 블록만 뽑아 파싱 */
function safeParseJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
