-- ============================================================================
-- 진단: 거래처 주문 화면(/customer/order) 의 품목 dropdown 이 비어 있을 때
-- ----------------------------------------------------------------------------
-- 실행 방법: Supabase Dashboard → SQL Editor → 본 파일 붙여넣고 Run
-- 한 쿼리씩 실행해도 됨. 결과를 보고 어떤 정책/데이터가 누락됐는지 진단.
-- ============================================================================

-- ─── 1. 활성 품목이 DB 에 존재하는가? ───────────────────────────────────────
-- 기대: 최소 1개 이상 행. 0건이면 /admin/products 에서 품목 등록 필요.
SELECT id, name, type, base_price, is_active, created_at
FROM products
ORDER BY created_at;


-- ─── 2. is_active = true 인 품목이 몇 개? ──────────────────────────────────
-- 기대: 1개 이상. 0이면 모든 품목이 비활성 → /admin/products 에서 활성화.
SELECT COUNT(*) AS active_product_count
FROM products
WHERE is_active = true;


-- ─── 3. RLS 정책이 products 테이블에 적용돼 있는가? ─────────────────────────
-- 기대: 최소 4개 정책 (admin_all_products / chair_read_products /
--                       cust_read_products / 또는 동등 정책).
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'products'
ORDER BY policyname;


-- ─── 4. 거래처용 SELECT 정책이 정확히 설정돼 있는가? ────────────────────────
-- 기대: cust_read_products 정책이 존재하고 qual 에 'is_active' 조건 포함.
-- 누락시: 아래 5번 쿼리 실행해서 정책 재생성.
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'products'
  AND policyname LIKE 'cust%';


-- ─── 5. 누락된 정책 복구 (필요 시에만 실행) ─────────────────────────────────
-- 4번 결과가 비어 있을 때만 실행. 멱등 안전.
-- DROP POLICY IF EXISTS "cust_read_products" ON products;
-- CREATE POLICY "cust_read_products" ON products FOR SELECT
--   USING (current_role_v() = 'customer' AND is_active = true);


-- ─── 6. 현재 로그인된 거래처가 자기 회사 정보를 읽을 수 있는가? ─────────────
-- 기대: customers 에 cust_read_own_company 정책 존재.
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'customers'
  AND policyname = 'cust_read_own_company';


-- ─── 7. helper 함수 동작 확인 (관리자 계정으로 실행하면 super_admin/admin) ──
-- 기대: 정상 텍스트 반환 (NULL 이면 user_profiles 행이 없거나 함수 미정의).
SELECT current_role_v() AS my_role, current_customer_id() AS my_customer_id;


-- ─── 8. user_profiles 의 customer 역할 사용자 + customer_id 매칭 확인 ──────
-- 기대: customer 역할 사용자 모두 customer_id 가 not null + customers 존재.
SELECT up.id, up.role, up.name, up.customer_id, c.company_name
FROM user_profiles up
LEFT JOIN customers c ON c.id = up.customer_id
WHERE up.role = 'customer'
ORDER BY up.created_at;
