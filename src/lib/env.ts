// ============================================================================
// 환경 감지 helpers — 운영/개발 모드 분기에서 단일 진실 공급원으로 사용
// ============================================================================

/**
 * Supabase 가 실제로 연결 가능한 상태인지 확인.
 *
 * false 인 경우:
 *   - URL 또는 anon key 가 비어 있음
 *   - 값에 공백만 있음
 *   - .env.local.example 의 placeholder 값(`YOUR-PROJECT`, `YOUR_ANON_KEY`)이 그대로 들어있음
 */
export function isSupabaseConfigured(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

  if (!url || !key) return false;
  if (url.includes('YOUR-PROJECT')) return false;
  if (key.startsWith('YOUR_') || key.includes('YOUR_ANON')) return false;

  return true;
}

/** Supabase 미연결 시 true — 1234/1234 우회·5역할 빠른 전환 등 dev UI 활성 */
export const isDevMode = !isSupabaseConfigured();
