#!/usr/bin/env bash
# ============================================================================
# .env.local 의 핵심 변수를 Vercel(production/preview/development)에 등록
# 사용:  bash scripts/vercel-env-push.sh
# 전제:  vercel login + vercel link 완료 (.vercel 존재)
# 주의:  비밀키는 .env.local 에서 읽어옴 — 이 스크립트에 하드코딩하지 않음
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ENVFILE=".env.local"
[ -f "$ENVFILE" ] || { echo "❌ $ENVFILE 없음"; exit 1; }

ENVIRONMENTS=(production preview development)

# .env.local 에서 그대로 읽어 등록할 변수
FROM_FILE=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ACIS_API_URL
)
# 운영 도메인은 localhost 가 아니어야 하므로 명시적으로 지정
APP_URL="https://hongi-omwis.vercel.app"

get_val() { sed -n "s/^$1=//p" "$ENVFILE" | head -1; }

add_var() {
  local key="$1" val="$2"
  [ -z "$val" ] && { echo "  · skip $key (빈 값)"; return; }
  for env in "${ENVIRONMENTS[@]}"; do
    # 이미 있으면 먼저 제거(덮어쓰기)
    printf 'y\n' | vercel env rm "$key" "$env" >/dev/null 2>&1 || true
    if printf '%s' "$val" | vercel env add "$key" "$env" >/dev/null 2>&1; then
      echo "  ✓ $key [$env]"
    else
      echo "  ✗ $key [$env] 실패"
    fi
  done
}

echo "▶ Vercel 환경변수 등록 시작"
for key in "${FROM_FILE[@]}"; do
  add_var "$key" "$(get_val "$key")"
done
add_var NEXT_PUBLIC_APP_URL "$APP_URL"

echo ""
echo "✅ 등록 완료. 확인: vercel env ls"
echo "🚀 재배포(필수): vercel --prod --yes"
