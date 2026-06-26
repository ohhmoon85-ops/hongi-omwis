-- ════════════════════════════════════════════════════════════════════════════
-- OMWIS — 중복 시드 계정 정리
-- ────────────────────────────────────────────────────────────────────────────
-- 적용 시점: seed-users.mjs 의 USERS 목록이 정리된 후 (admin/driver/customer 는
-- 사용자가 만드신 @hongi.co.kr / @samscb.kr 도메인을 기준으로 통일됨)
-- 이 SQL 은 그 통일 이전에 만들어졌던 중복 행 3개를 제거합니다.
--
-- 적용 방법: Supabase Dashboard → SQL Editor 에 붙여넣고 Run
-- ⚠️ auth.users 삭제 시 user_profiles 도 CASCADE 로 함께 삭제됩니다.
-- ════════════════════════════════════════════════════════════════════════════

DELETE FROM auth.users WHERE email IN (
  'byun@hongi.co.kr',     -- super_admin 중복 (admin@hongi.co.kr 이 정본)
  'driver@hongi.test',    -- driver 중복 (driver@hongi.co.kr 이 정본)
  'kim@samscb.kr'         -- customer 중복 (customer@samscb.kr 이 정본, 거래처 연결됨)
);

-- 결과 확인 — 5개 계정만 남아야 정상
SELECT u.email, p.role, p.name, c.company_name AS linked_customer
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
LEFT JOIN customers c     ON c.id = p.customer_id
ORDER BY p.role;
