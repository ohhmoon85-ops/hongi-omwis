-- ============================================================================
-- 002. 전자세금계산서 — 거래처 사업자정보 + invoices 테이블
-- 적용: Supabase Dashboard → SQL Editor 에 붙여넣고 RUN
-- 전제: 001(schema.sql)의 current_role_v()/current_customer_id() 가 이미 존재
-- ============================================================================

-- 거래처 세금계산서용 사업자정보 (공급받는자)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS business_number VARCHAR(12),  -- 사업자등록번호 XXX-XX-XXXXX
  ADD COLUMN IF NOT EXISTS ceo_name VARCHAR(50),         -- 대표자
  ADD COLUMN IF NOT EXISTS biz_type VARCHAR(100),        -- 업태
  ADD COLUMN IF NOT EXISTS biz_item VARCHAR(100),        -- 종목
  ADD COLUMN IF NOT EXISTS tax_email VARCHAR(100);       -- 세금계산서 수신 이메일

-- 전자세금계산서 (주문당 1건 정발행)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES customers(id),
  mgt_key VARCHAR(40) NOT NULL,             -- 발행 관리번호 (팝빌 mgtKey)
  nts_confirm_number VARCHAR(40),           -- 국세청 승인번호
  supply_amount INTEGER NOT NULL,           -- 공급가액
  tax_amount INTEGER NOT NULL,              -- 세액(부가세 10%)
  total_amount INTEGER NOT NULL,            -- 합계 (공급가액 + 세액)
  status VARCHAR(20) DEFAULT 'issued'
    CHECK (status IN ('draft','issued','sent','failed','cancelled')),
  issue_date DATE DEFAULT CURRENT_DATE,     -- 작성일자
  is_mock BOOLEAN DEFAULT true,             -- Mock 발행 여부
  pdf_url TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- super_admin / admin: 전체 권한
CREATE POLICY "admin_all_invoices" ON invoices FOR ALL
  USING (current_role_v() IN ('super_admin','admin'));
-- chairman: 읽기 전용
CREATE POLICY "chair_read_invoices" ON invoices FOR SELECT
  USING (current_role_v() = 'chairman');
-- customer: 자사 세금계산서만 조회
CREATE POLICY "cust_read_own_invoices" ON invoices FOR SELECT
  USING (current_role_v() = 'customer' AND customer_id = current_customer_id());
