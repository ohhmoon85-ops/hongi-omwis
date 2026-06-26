# Vercel 환경변수 1회 셋업

`.env.local` 은 `.gitignore` 에 의해 푸시되지 않아 **Vercel 빌드 환경에서는 보이지 않습니다.** 같은 키를 Vercel 프로젝트 설정에 별도 등록해야 운영 배포가 정상 동작합니다.

## 등록 위치

Vercel 대시보드 → `hongi-omwis` 프로젝트 → **Settings** → **Environment Variables**

각 변수마다:
- **Key**: 변수명
- **Value**: 실제 값
- **Environments**: `Production`, `Preview`, `Development` 모두 체크 (브랜치별 다르게 쓰려면 분리)

저장 후 **Deployments → 가장 최근 빌드 → Redeploy** 클릭해야 새 값 반영.

---

## 🔴 필수 (이게 없으면 운영 모드 작동 안 함)

| Key | Value | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xinqeredbokijbzktscp.supabase.co` | 빌드 시점에 클라이언트 번들에 박힘 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` (긴 JWT) | 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (긴 JWT) | ⚠️ 서버 전용. 절대 NEXT_PUBLIC_ 접두사 붙이지 말 것 |
| `NEXT_PUBLIC_APP_URL` | `https://hongi-omwis.vercel.app` (실제 도메인) | 알림톡 버튼 링크에 사용됨 |
| `CRON_SECRET` | 긴 랜덤 문자열 (예: `openssl rand -hex 32`) | Vercel cron 보호용 |
| `ACIS_API_URL` | `https://aluminum-coil-import-intelligence-s.vercel.app` | ACIS 신호·시세 위젯 |

---

## 🟡 선택 (없으면 Mock 모드 — 콘솔 로그만)

### 카카오 알림톡 (알리고 게이트웨이)

| Key | Value | 발급 |
|---|---|---|
| `KAKAO_API_KEY` | 알리고 `apikey` | https://aligo.in |
| `KAKAO_USER_ID` | 알리고 계정 ID | 동일 |
| `KAKAO_SENDER_KEY` | 발신프로필 `senderkey` | 알리고 콘솔 |
| `KAKAO_SENDER` | 등록된 발신번호 (예: `0312345678`) | 알리고 콘솔 사전 등록 |

⚠️ **4개 모두** 채워야 실 발송. 하나라도 비면 자동 Mock.

### 이메일 (Resend)

| Key | Value | 발급 |
|---|---|---|
| `RESEND_API_KEY` | `re_xxx...` | https://resend.com |
| `RESEND_FROM_EMAIL` | `noreply@hongi.co.kr` (또는 검증된 도메인) | Resend 콘솔에서 도메인 검증 필요 |

### 세금계산서 (팝빌 + 공급자 정보)

| Key | Value | 비고 |
|---|---|---|
| `SUPPLIER_BIZ_NUMBER` | `123-45-67890` | (주)홍지 사업자등록번호 |
| `SUPPLIER_NAME` | `(주)홍지` | |
| `SUPPLIER_CEO` | `변지수` | |
| `SUPPLIER_ADDRESS` | (사업장 주소) | |
| `SUPPLIER_BIZ_TYPE` | `제조` | |
| `SUPPLIER_BIZ_ITEM` | `알루미늄` | |
| `SUPPLIER_EMAIL` | `tax@hongi.co.kr` | |
| `POPBILL_LINK_ID` | 팝빌 발급 | https://www.popbill.com — 미설정 시 데모 발행 |
| `POPBILL_SECRET` | 팝빌 발급 | 동일 |

### 사업자번호 검증 (국세청)

| Key | Value | 발급 |
|---|---|---|
| `BIZ_VERIFY_API_KEY` | 인증키 (Encoding) | https://data.go.kr — "국세청_사업자등록정보 진위확인" 신청 (즉시 자동 승인) |

미설정 시 체크섬만 검증 (휴/폐업 조회 안 됨).

---

## 🔍 정상 동작 검증

Vercel 배포 후 다음 확인:

1. **로그인 가능** — `https://hongi-omwis.vercel.app/login` 에서 `byun@hongi.co.kr` / `1234` 로 로그인 → `/admin/dashboard` 로 이동
2. **거래처 주문 흐름** — `customer@samscb.kr` 로 로그인 → 주문 제출 → 어드민 화면에서 실시간 표시
3. **회장 모니터** — `chairman@hongi.co.kr` 로 로그인 → ACIS 카드에 SHFE/LME 실 데이터, MarketsWidget 4타일 표시 (MOCK 라벨 없어야 함)
4. **알림 audit** — `/admin/notifications` 에 발송 이력 적재
5. **cron** — Vercel 대시보드 → Cron Jobs 탭에 `weekly-summary` `daily-summary` 2개 보임. "Trigger" 버튼으로 수동 테스트 가능
6. **카카오 실발송** (선택) — 주문 승인 → 거래처 카카오톡에 알림톡 도착 (템플릿 등록 + 4개 키 셋업 후)

---

## ⚡ 환경변수 일괄 등록 팁

Vercel UI 에서 1개씩 입력하는 대신:

1. `Settings → Environment Variables` 페이지 우측 상단 **「Import .env」** 버튼
2. `.env.local` 파일 자체를 업로드 또는 내용 복사·붙여넣기
3. 자동으로 모든 키 일괄 등록됨

또는 Vercel CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# 값 붙여넣기 → Enter
```

---

## 🚨 주의사항

- **`SUPABASE_SERVICE_ROLE_KEY` 는 절대 `NEXT_PUBLIC_` 접두사 X** — 클라이언트 번들에 포함되면 보안 사고
- **NEXT_PUBLIC_* 변경 시 재배포 필수** — 빌드 시점에 정적으로 박혀 들어감
- **환경변수 변경 후 Redeploy** — 기존 빌드는 옛 값 캐시. Deployments 에서 최신 빌드를 "Redeploy" 또는 main 에 빈 커밋 푸시
- **Preview 도 같이 등록 권장** — 브랜치 빌드도 Supabase 가 필요하면

---

## 📋 최소 등록 체크리스트 (운영 전환)

다음 5개만 채우면 **모든 핵심 기능이 운영 모드로 전환**됩니다:

```
NEXT_PUBLIC_SUPABASE_URL=https://xinqeredbokijbzktscp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=https://your-actual-vercel-url.vercel.app
CRON_SECRET=긴-랜덤-문자열-32자-이상
```

나머지(카카오·이메일·사업자 검증·세금계산서)는 해당 기능을 실제 사용할 시점에 추가하면 됩니다 — 기본값으로 Mock 동작.
