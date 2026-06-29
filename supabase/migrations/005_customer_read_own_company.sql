-- ============================================================================
-- 005. 거래처 본인 회사 정보 조회 정책
-- 적용: Supabase Dashboard → SQL Editor 에 붙여넣고 RUN
-- ----------------------------------------------------------------------------
-- 문제: customers 테이블에 customer 역할용 SELECT 정책이 없어,
--       거래처 주문 화면(/customer/order)이 본인 회사(신용한도·미수 등)를
--       읽지 못하고 'customer not found' 예외 → 전역 에러 화면 발생.
-- 해결: 거래처가 "자기 회사 행만" 읽도록 허용 (RLS 로 타사 차단 유지).
-- ============================================================================

DROP POLICY IF EXISTS "cust_read_own_company" ON customers;
CREATE POLICY "cust_read_own_company" ON customers FOR SELECT
  USING (current_role_v() = 'customer' AND id = current_customer_id());
