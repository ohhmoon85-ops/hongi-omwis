-- ════════════════════════════════════════════════════════════════════════════
-- OMWIS — Supabase SQL Editor 일괄 적용 스크립트 (멱등 실행)
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법:
--   1) Supabase Dashboard → SQL Editor → New query
--   2) 이 파일 전체를 복사 → 붙여넣기 → Run
--   3) 마지막 SELECT 결과로 검증
-- ────────────────────────────────────────────────────────────────────────────
-- 이 스크립트가 하는 일:
--   ① 11 + 1 테이블 생성 (이미 있으면 건너뜀)
--   ② 누적된 시드 중복 행 자동 정리
--   ③ company_name / product name 에 UNIQUE 제약 추가 → 향후 중복 방지
--   ④ 헬퍼 함수·RLS 정책 모두 멱등 재정의 (DROP IF EXISTS + CREATE)
--   ⑤ 시드 데이터 (품목 3, 거래처 3) — 이미 있으면 건너뜀
--   ⑥ 마지막에 검증용 SELECT 7건
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- ① 테이블 생성 (12개)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL
    CHECK (role IN ('chairman','super_admin','admin','driver','customer')),
  name VARCHAR(100),
  customer_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  former_dealer VARCHAR(50),
  transferred_at TIMESTAMPTZ,
  business_number VARCHAR(12),
  ceo_name VARCHAR(50),
  biz_type VARCHAR(100),
  biz_item VARCHAR(100),
  tax_email VARCHAR(100),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS customer_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  unit_price INTEGER NOT NULL,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  UNIQUE(customer_id, product_id)
);

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

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS safety_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) UNIQUE,
  min_quantity DECIMAL(10,2) NOT NULL,
  alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES customers(id),
  mgt_key VARCHAR(40) NOT NULL,
  nts_confirm_number VARCHAR(40),
  supply_amount INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'issued'
    CHECK (status IN ('draft','issued','sent','failed','cancelled')),
  issue_date DATE DEFAULT CURRENT_DATE,
  is_mock BOOLEAN DEFAULT true,
  pdf_url TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ════════════════════════════════════════════════════════════════════════════
-- ② 누적된 시드 중복 정리 — 같은 이름의 행 중 가장 오래된 1개만 남김
-- ════════════════════════════════════════════════════════════════════════════

WITH ranked AS (
  SELECT id, company_name,
         ROW_NUMBER() OVER (PARTITION BY company_name ORDER BY created_at ASC) AS rn
  FROM customers
)
DELETE FROM customers WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id, name,
         ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) AS rn
  FROM products
)
DELETE FROM products WHERE id IN (SELECT id FROM ranked WHERE rn > 1);


-- ════════════════════════════════════════════════════════════════════════════
-- ③ UNIQUE 제약 추가 — 향후 중복 입력 방지 (이미 있으면 무시)
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_company_name_unique UNIQUE (company_name);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_name_unique UNIQUE (name);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- ④ 주문번호 자동 생성 함수
-- ════════════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════════════
-- ⑤ RLS 활성화 (12개 테이블)
-- ════════════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════════════
-- ⑥ 헬퍼 함수 — SECURITY DEFINER 로 RLS 재귀 회피
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION current_role_v() RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_customer_id() RETURNS UUID AS $$
  SELECT customer_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════════════════
-- ⑦ RLS 정책 (32개) — 모두 DROP IF EXISTS + CREATE 형태로 멱등
-- ════════════════════════════════════════════════════════════════════════════

-- user_profiles (2)
DROP POLICY IF EXISTS "self_read_profile" ON user_profiles;
CREATE POLICY "self_read_profile" ON user_profiles FOR SELECT
  USING (id = auth.uid());
DROP POLICY IF EXISTS "super_admin_all_profiles" ON user_profiles;
CREATE POLICY "super_admin_all_profiles" ON user_profiles FOR ALL
  USING (current_role_v() = 'super_admin');

-- super_admin / admin: 전체 권한 (11)
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

-- chairman: 전체 SELECT 만 (8) — ⚠️ INSERT/UPDATE/DELETE 정책 절대 부여 금지
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

-- driver: 배송 본인 건만 (3)
DROP POLICY IF EXISTS "driver_read_deliveries" ON deliveries;
CREATE POLICY "driver_read_deliveries" ON deliveries FOR SELECT USING (current_role_v() = 'driver');
DROP POLICY IF EXISTS "driver_update_deliveries" ON deliveries;
CREATE POLICY "driver_update_deliveries" ON deliveries FOR UPDATE USING (current_role_v() = 'driver');
DROP POLICY IF EXISTS "driver_read_orders" ON orders;
CREATE POLICY "driver_read_orders" ON orders FOR SELECT USING (current_role_v() = 'driver');

-- customer: 자사 데이터만 (8)
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
DROP POLICY IF EXISTS "cust_read_products" ON products;
CREATE POLICY "cust_read_products" ON products FOR SELECT
  USING (current_role_v() = 'customer' AND is_active = true);
DROP POLICY IF EXISTS "cust_read_own_prices" ON customer_prices;
CREATE POLICY "cust_read_own_prices" ON customer_prices FOR SELECT
  USING (current_role_v() = 'customer' AND customer_id = current_customer_id());
DROP POLICY IF EXISTS "cust_read_own_invoices" ON invoices;
CREATE POLICY "cust_read_own_invoices" ON invoices FOR SELECT
  USING (current_role_v() = 'customer' AND customer_id = current_customer_id());


-- ════════════════════════════════════════════════════════════════════════════
-- ⑧ 시드 데이터 (UNIQUE 적용 후라 ON CONFLICT 정상 동작)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO products (name, type, thickness, width, base_price)
VALUES
  ('생 알루미늄 0.5mm × 1000mm', 'raw',   0.5, 1000, 4500),
  ('지용성 코팅 0.3mm × 800mm',  'oil',   0.3,  800, 5200),
  ('수용성 코팅 0.3mm × 800mm',  'water', 0.3,  800, 5400)
ON CONFLICT (name) DO NOTHING;

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
ON CONFLICT (company_name) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- ⑨ 검증 SELECT — 마지막 결과 패널에서 확인
-- ════════════════════════════════════════════════════════════════════════════

SELECT '✅ 검증 1 — 거래처' AS step, company_name, former_dealer, credit_limit
FROM customers ORDER BY created_at;

SELECT '✅ 검증 2 — 품목' AS step, name, type, base_price
FROM products ORDER BY created_at;

SELECT '✅ 검증 3 — 정책 개수 (32 기대)' AS step, COUNT(*) AS policy_count
FROM pg_policies WHERE schemaname = 'public';

SELECT '✅ 검증 4 — UNIQUE 제약' AS step, conname
FROM pg_constraint
WHERE conname IN ('customers_company_name_unique', 'products_name_unique');

SELECT '✅ 검증 5 — 사용자 (시드 유저 5명 기대)' AS step,
       u.email, p.role, p.name, c.company_name AS linked_customer
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
LEFT JOIN customers c     ON c.id = p.customer_id
ORDER BY p.role;
