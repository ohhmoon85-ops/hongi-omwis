-- ════════════════════════════════════════════════════════════════════════════
-- OMWIS — 구버전 시드 계정 정리 (5개)
-- ────────────────────────────────────────────────────────────────────────────
-- 정본 5계정으로 통일 (모두 @hongjee.co.kr 또는 @samscb.kr):
--   chairman@hongjee.co.kr / admin@hongjee.co.kr / ops@hongjee.co.kr
--   driver@hongjee.co.kr   / customer@samscb.kr
--
-- ⚠️ scripts/seed-users.mjs 가 동일한 정리를 자동으로 수행합니다.
-- 이 SQL 은 SQL Editor 만 사용하는 경우의 수동 대안입니다.
-- (둘 다 멱등 — 중복 실행해도 안전)
-- ════════════════════════════════════════════════════════════════════════════

DELETE FROM auth.users WHERE email IN (
  'byun@hongjee.co.kr',     -- 구 super_admin (→ admin@hongjee.co.kr 로 통합)
  'driver@hongi.test',    -- 구 driver     (→ driver@hongjee.co.kr 로 통합)
  'kim@samscb.kr',        -- 구 customer   (→ customer@samscb.kr 로 통합)
  'chairman@hongi.test',  -- 구 chairman   (→ chairman@hongjee.co.kr 로 통합)
  'admin@hongi.test'      -- 구 admin      (→ ops@hongjee.co.kr 로 통합)
);

-- 결과 확인 — 정본 5계정만 남아야 정상 (seed-users.mjs 실행 후)
SELECT u.email, p.role, p.name, c.company_name AS linked_customer
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
LEFT JOIN customers c     ON c.id = p.customer_id
ORDER BY p.role;
