-- ============================================================================
-- OMWIS — Supabase 초기 스키마 (Phase 1~5 전체)
-- 적용 방법: Supabase Dashboard → SQL Editor 에 붙여넣고 RUN
-- ============================================================================

-- ① 사용자 프로필 (auth.users 와 1:1, role 보관)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL
    CHECK (role IN ('chairman','super_admin','admin','driver','customer')),
  name VARCHAR(100),
  customer_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ② 거래처(고객사) 마스터 — 본사와 직접 거래 (대리점 계층 없음, D2C)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(100) NOT NULL,
  contact_name VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  delivery_address TEXT,
  price_tier VARCHAR(10) DEFAULT 'standard',
  credit_limit INTEGER DEFAULT 0,
  current_balance INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  former_dealer VARCHAR(50),         -- 기존 소속 대리점명 (이관 이력 추적용)
  transferred_at TIMESTAMPTZ,        -- 본사 직거래 전환일
  business_number VARCHAR(12),       -- 사업자등록번호 (세금계산서용)
  ceo_name VARCHAR(50),              -- 대표자
  biz_type VARCHAR(100),             -- 업태
  biz_item VARCHAR(100),             -- 종목
  tax_email VARCHAR(100),            -- 세금계산서 수신 이메일
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ③ 품목 마스터
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('raw','oil','water')),
  thickness DECIMAL(5,2),
  width INTEGER,
  unit VARCHAR(10) DEFAULT 'kg',
  base_price INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ④ 거래처별 개별 단가
CREATE TABLE IF NOT EXISTS customer_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  unit_price INTEGER NOT NULL,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  UNIQUE(customer_id, product_id)
);

-- ⑤ 주문 헤더
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','processing',
                      'ready','shipping','delivered','cancelled')),
  requested_date DATE,
  confirmed_date DATE,
  total_amount INTEGER DEFAULT 0,
  paid_amount INTEGER DEFAULT 0,
  memo TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ⑥ 주문 상세 품목
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ⑦ 창고 재고
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  lot_number VARCHAR(50),
  location VARCHAR(50),
  quantity DECIMAL(10,2) NOT NULL,
  initial_quantity DECIMAL(10,2),
  import_date DATE,
  expiry_date DATE,
  qr_code TEXT,
  customs_doc_url TEXT,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','reserved','depleted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ⑧ 재고 이동 이력
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id),
  product_id UUID REFERENCES products(id),
  log_type VARCHAR(10) NOT NULL CHECK (log_type IN ('in','out','adjust')),
  quantity DECIMAL(10,2) NOT NULL,
  order_id UUID REFERENCES orders(id),
  input_method VARCHAR(10) DEFAULT 'manual'
    CHECK (input_method IN ('manual','qr')),
  memo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ⑨ 배송
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  driver_name VARCHAR(50),
  driver_phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','departed','delivered','failed')),
  scheduled_date DATE,
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  completion_photo_url TEXT,
  delivery_address TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ⑩ 알림 이력
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL,
  recipient_type VARCHAR(10) CHECK (recipient_type IN ('chairman','admin','customer')),
  recipient_id UUID,
  channel VARCHAR(10) CHECK (channel IN ('kakao','email','both')),
  message TEXT,
  status VARCHAR(10) DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ⑪ 안전재고 설정
CREATE TABLE IF NOT EXISTS safety_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) UNIQUE,
  min_quantity DECIMAL(10,2) NOT NULL,
  alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ⑫ 전자세금계산서 (주문당 1건 정발행, 부가세 별도)
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
  is_mock BOOLEAN DEFAULT true,
  pdf_url TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 주문번호 자동 생성 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYYMMDD');
  seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq FROM orders
  WHERE order_number LIKE 'ORD-' || today || '%';
  RETURN 'ORD-' || today || '-' || LPAD(seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security (RLS) 정책
-- 5계층 권한: chairman / super_admin / admin / driver / customer
-- ⚠️ chairman 은 SELECT 만 — INSERT/UPDATE/DELETE 정책 절대 부여 금지
-- ============================================================================

ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_stock    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 헬퍼 함수 (정책보다 먼저 정의)
-- ⚠️ SECURITY DEFINER 필수 — user_profiles 의 RLS 를 우회해야 정책 안에서
--    user_profiles 를 다시 조회할 때 무한 재귀(42P17)가 발생하지 않음
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_role_v() RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_customer_id() RETURNS UUID AS $$
  SELECT customer_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- user_profiles: 본인 SELECT, 슈퍼관리자 전체
-- super_admin 판정은 SECURITY DEFINER 함수로 — 정책 안에서 user_profiles 를
-- 직접 서브쿼리하면 재귀하므로 절대 금지
DROP POLICY IF EXISTS "self_read_profile" ON user_profiles;
CREATE POLICY "self_read_profile" ON user_profiles FOR SELECT
  USING (id = auth.uid());
DROP POLICY IF EXISTS "super_admin_all_profiles" ON user_profiles;
CREATE POLICY "super_admin_all_profiles" ON user_profiles FOR ALL
  USING (current_role_v() = 'super_admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- super_admin / admin: 전체 권한
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_customers"  ON customers;
CREATE POLICY "admin_all_customers"  ON customers       FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_products"   ON products;
CREATE POLICY "admin_all_products"   ON products        FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_cprices"    ON customer_prices;
CREATE POLICY "admin_all_cprices"    ON customer_prices FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_orders"     ON orders;
CREATE POLICY "admin_all_orders"     ON orders          FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_oitems"     ON order_items;
CREATE POLICY "admin_all_oitems"     ON order_items     FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_inventory"  ON inventory;
CREATE POLICY "admin_all_inventory"  ON inventory       FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_invlogs"    ON inventory_logs;
CREATE POLICY "admin_all_invlogs"    ON inventory_logs  FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_deliveries" ON deliveries;
CREATE POLICY "admin_all_deliveries" ON deliveries      FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_notify"     ON notifications;
CREATE POLICY "admin_all_notify"     ON notifications   FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_safety"     ON safety_stock;
CREATE POLICY "admin_all_safety"     ON safety_stock    FOR ALL USING (current_role_v() IN ('super_admin','admin'));
DROP POLICY IF EXISTS "admin_all_invoices"   ON invoices;
CREATE POLICY "admin_all_invoices"   ON invoices        FOR ALL USING (current_role_v() IN ('super_admin','admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- chairman: 전체 SELECT 만 (Read-Only) — INSERT/UPDATE/DELETE 정책 없음
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chair_read_customers"  ON customers;
CREATE POLICY "chair_read_customers"  ON customers       FOR SELECT USING (current_role_v() = 'chairman');
DROP POLICY IF EXISTS "chair_read_products"   ON products;
CREATE POLICY "chair_read_products"   ON products        FOR SELECT USING (current_role_v() = 'chairman');
DROP POLICY IF EXISTS "chair_read_orders"     ON orders;
CREATE POLICY "chair_read_orders"     ON orders          FOR SELECT USING (current_role_v() = 'chairman');
DROP POLICY IF EXISTS "chair_read_oitems"     ON order_items;
CREATE POLICY "chair_read_oitems"     ON order_items     FOR SELECT USING (current_role_v() = 'chairman');
DROP POLICY IF EXISTS "chair_read_inventory"  ON inventory;
CREATE POLICY "chair_read_inventory"  ON inventory       FOR SELECT USING (current_role_v() = 'chairman');
DROP POLICY IF EXISTS "chair_read_invlogs"    ON inventory_logs;
CREATE POLICY "chair_read_invlogs"    ON inventory_logs  FOR SELECT USING (current_role_v() = 'chairman');
DROP POLICY IF EXISTS "chair_read_deliveries" ON deliveries;
CREATE POLICY "chair_read_deliveries" ON deliveries      FOR SELECT USING (current_role_v() = 'chairman');
DROP POLICY IF EXISTS "chair_read_invoices"   ON invoices;
CREATE POLICY "chair_read_invoices"   ON invoices        FOR SELECT USING (current_role_v() = 'chairman');

-- ─────────────────────────────────────────────────────────────────────────────
-- driver: 배송 본인 건 SELECT/UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "driver_read_deliveries" ON deliveries;
CREATE POLICY "driver_read_deliveries" ON deliveries FOR SELECT USING (current_role_v() = 'driver');
DROP POLICY IF EXISTS "driver_update_deliveries" ON deliveries;
CREATE POLICY "driver_update_deliveries" ON deliveries FOR UPDATE USING (current_role_v() = 'driver');
DROP POLICY IF EXISTS "driver_read_orders" ON orders;
CREATE POLICY "driver_read_orders" ON orders FOR SELECT USING (current_role_v() = 'driver');

-- ─────────────────────────────────────────────────────────────────────────────
-- customer: 자사 데이터만
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cust_read_own_orders" ON orders;
CREATE POLICY "cust_read_own_orders" ON orders FOR SELECT
  USING (current_role_v() = 'customer' AND customer_id = current_customer_id());
DROP POLICY IF EXISTS "cust_create_orders" ON orders;
CREATE POLICY "cust_create_orders" ON orders FOR INSERT
  WITH CHECK (current_role_v() = 'customer' AND customer_id = current_customer_id());

DROP POLICY IF EXISTS "cust_read_own_oitems" ON order_items;
CREATE POLICY "cust_read_own_oitems" ON order_items FOR SELECT
  USING (current_role_v() = 'customer'
         AND order_id IN (SELECT id FROM orders WHERE customer_id = current_customer_id()));
DROP POLICY IF EXISTS "cust_create_oitems" ON order_items;
CREATE POLICY "cust_create_oitems" ON order_items FOR INSERT
  WITH CHECK (current_role_v() = 'customer'
              AND order_id IN (SELECT id FROM orders WHERE customer_id = current_customer_id()));

DROP POLICY IF EXISTS "cust_read_own_deliveries" ON deliveries;
CREATE POLICY "cust_read_own_deliveries" ON deliveries FOR SELECT
  USING (current_role_v() = 'customer'
         AND order_id IN (SELECT id FROM orders WHERE customer_id = current_customer_id()));

-- 거래처는 품목 마스터를 조회 가능 (주문 화면에서 필요)
DROP POLICY IF EXISTS "cust_read_products" ON products;
CREATE POLICY "cust_read_products" ON products FOR SELECT
  USING (current_role_v() = 'customer' AND is_active = true);

-- 거래처는 자사 단가만 조회
DROP POLICY IF EXISTS "cust_read_own_prices" ON customer_prices;
CREATE POLICY "cust_read_own_prices" ON customer_prices FOR SELECT
  USING (current_role_v() = 'customer' AND customer_id = current_customer_id());

-- 거래처는 자사 세금계산서만 조회
DROP POLICY IF EXISTS "cust_read_own_invoices" ON invoices;
CREATE POLICY "cust_read_own_invoices" ON invoices FOR SELECT
  USING (current_role_v() = 'customer' AND customer_id = current_customer_id());

-- ============================================================================
-- 시드 데이터 (개발 시작용)
-- ============================================================================

-- 품목 마스터 (PCB용 알루미늄 코일 3종)
INSERT INTO products (name, type, thickness, width, base_price)
VALUES
  ('생 알루미늄 0.5mm × 1000mm', 'raw',   0.5, 1000, 4500),
  ('지용성 코팅 0.3mm × 800mm',  'oil',   0.3,  800, 5200),
  ('수용성 코팅 0.3mm × 800mm',  'water', 0.3,  800, 5400)
ON CONFLICT DO NOTHING;

-- 거래처 샘플 3개 (그 중 2개는 대리점에서 이관된 D2C 전환 거래처)
INSERT INTO customers (company_name, contact_name, phone, email, address,
                       delivery_address, price_tier, credit_limit,
                       former_dealer, transferred_at, memo)
VALUES
  ('(주)삼성회로기판', '김민수', '010-1111-2222', 'kim@samscb.kr',
   '경기 수원시 영통구 광교로 100', '경기 수원시 영통구 광교로 100',
   'gold', 50000000,
   '서울대리점', NOW(),
   '대리점 이관 거래처 — 직거래 1호'),

  ('(주)LG PCB',     '박지영', '010-3333-4444', 'park@lgpcb.kr',
   '경북 구미시 공단동 200', '경북 구미시 공단동 200',
   'gold', 80000000,
   '대구대리점', NOW(),
   '대리점 이관 거래처 — 신용 한도 8천만'),

  ('소형부품제작소',  '이상호', '010-5555-6666', 'lee@spm.kr',
   '인천 남동구 산단로 50', '인천 남동구 산단로 50',
   'standard', 10000000,
   NULL, NULL,
   '신규 직거래 거래처')
ON CONFLICT DO NOTHING;
