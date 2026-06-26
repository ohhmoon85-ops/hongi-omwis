# OMWIS 배포 체크리스트 (dev 목업 → Supabase 실연결)

현재 상태: `.env.local` 없음 → **dev 목업 모드**로 동작 중.
`NEXT_PUBLIC_SUPABASE_URL` 이 채워지는 순간 자동으로 **운영 모드**(실 인증 + RLS)로 전환됩니다.
(분기 기준: `src/lib/dev-data.ts` 의 `isDevMode`)

---

## 1. Supabase 프로젝트 준비
- [ ] supabase.com 에서 프로젝트 생성 (리전: ap-northeast-2 서울 권장)
- [ ] Project Settings → API 에서 다음 3개 키 확보
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 절대 클라이언트 노출 금지)

## 2. 스키마 적용
- [ ] Supabase Dashboard → SQL Editor 에 `supabase/schema.sql` 전체 붙여넣고 RUN
- [ ] ⚠️ 적용 후 확인: `SELECT current_role_v();` 가 에러 없이 실행되는지
      (RLS 무한 재귀 42P17 이 안 나야 정상 — SECURITY DEFINER 적용됨)

## 3. 환경변수 설정
- [ ] 루트에 `.env.local` 생성 (`.env.local.example` 복사)
- [ ] Supabase 3개 키 입력
- [ ] (선택) 카카오/Resend 키 — 비우면 알림은 콘솔 Mock 출력
- [ ] (선택) `ACIS_API_URL` — 비우면 ACIS 카드는 Mock 데이터 (Phase 3)

## 4. 계정 발급 (폐쇄형 — 자체 회원가입 없음)
슈퍼 관리자가 Supabase Dashboard → Authentication → Add user 로 직접 생성:
- [ ] 각 사용자 생성 후, `user_profiles` 에 `id`(auth uid)·`role`·`name`·`customer_id` INSERT
- [ ] 최소 1명은 `role='super_admin'` (변지수 대표)
- [ ] 거래처 계정은 `role='customer'` + 해당 `customers.id` 를 `customer_id` 에 연결

## 5. 배포 전 검증
- [ ] `npm run build` 통과 (현재 통과 확인됨)
- [ ] 운영 모드 로그인 → 역할별 홈 라우팅 확인
- [ ] 거래처로 주문 1건 접수 → 관리자 알림(콘솔/메일) 확인
- [ ] 권한 외 경로 접근 시 `/login?reason=forbidden` 리다이렉트 확인

## 6. Vercel 배포
- [ ] Vercel 프로젝트 연결 → 위 환경변수 동일하게 등록
- [ ] `NEXT_PUBLIC_APP_URL` 을 실제 도메인으로 변경

---

## ⚠️ 알려진 미완성 (배포는 가능하나 해당 역할은 빈 화면)
- **driver(배송 기사)** 로그인 시 홈이 `/admin/deliveries` 인데 **해당 페이지 미구현(Phase 4)** → 404.
  배송 역할 계정은 Phase 4 완료 후 발급 권장.
- 관리자 대시보드 KPI 5종은 아직 플레이스홀더(`-`) — 실데이터 미연결.
- 재고/배송/안전재고 화면 미구현 (스키마 테이블만 존재).
