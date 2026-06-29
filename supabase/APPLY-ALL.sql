-- ████████████████████████████████████████████████████████████████████████████
-- OMWIS — Supabase 통합 적용 스크립트 (APPLY-ALL)
-- 한 번에 붙여넣고 RUN 하세요. 전부 멱등(여러 번 실행해도 안전).
-- 순서: ① 전체 스키마·RLS·시드 → ② 배송모델/상태/역할 이관 → ③ 실시간 → ④ Storage
-- 생성: 기존 run-all.sql + 004 + 003 + storage SQL 통합 + 버킷 생성 포함
-- ████████████████████████████████████████████████████████████████████████████


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 1 — 전체 스키마 · RLS · 시드 (run-all.sql)                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
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

-- 2026-06-27: driver 역할 제거 (배송 모델 단순화 — 출고=완료).
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL
    CHECK (role IN ('chairman','super_admin','admin','customer')),
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
  -- 2026-06-27: 출고=완료 모델 — 5단계를 4단계로 축소 + returned 추가
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','approved','processing','shipped',
                      'cancelled','rejected','returned')),
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

-- 반품 이력 (2026-06-27 추가 — 출고=완료 모델에서 사후 하자 처리용)
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  restock BOOLEAN DEFAULT false,
  return_date DATE DEFAULT CURRENT_DATE,
  memo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
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

-- 주문 출고 처리 — FIFO lot 차감 + inventory_logs(out) 생성 (트랜잭션)
CREATE OR REPLACE FUNCTION dispatch_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_lot RECORD;
  v_remaining DECIMAL(10,2);
  v_take DECIMAL(10,2);
  v_user UUID := auth.uid();
BEGIN
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.name AS product_name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    v_remaining := v_item.quantity;
    FOR v_lot IN
      SELECT id, quantity FROM inventory
      WHERE product_id = v_item.product_id AND status = 'active' AND quantity > 0
      ORDER BY import_date ASC NULLS LAST, created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_lot.quantity);
      UPDATE inventory
      SET quantity = quantity - v_take,
          status = CASE WHEN (quantity - v_take) <= 0 THEN 'depleted' ELSE 'active' END,
          updated_at = NOW()
      WHERE id = v_lot.id;
      INSERT INTO inventory_logs
        (inventory_id, product_id, log_type, quantity, order_id, input_method, memo, created_by)
      VALUES
        (v_lot.id, v_item.product_id, 'out', -v_take, p_order_id, 'manual',
         '출고 — 주문 ' || SUBSTRING(p_order_id::text, 1, 8), v_user);
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION '재고 부족: % — 추가 %kg 필요', v_item.product_name, v_remaining;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 2 — 배송모델 단순화 · 상태/역할 이관 (004) [기존 DB 필수]            ║
-- ║ orders.status: ready→processing, shipping/delivered→shipped               ║
-- ║ driver 역할 제거(→admin) · returns 테이블                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ============================================================================
-- 004_shipping_model_refactor.sql
-- 배송 모델 단순화 — 출고=완료 + driver 역할 제거 + 반품 프로세스 추가
-- ----------------------------------------------------------------------------
-- 적용 방법: Supabase Dashboard → SQL Editor → 본 파일 전체 붙여넣고 RUN
-- 의존: 001 (schema.sql), 002 (tax_invoice), 003 (realtime)
-- ============================================================================

-- ─── ① orders.status 4단계로 단순화 ─────────────────────────────────────────
--
-- 기존: pending → approved → processing → ready → shipping → delivered (5단계)
-- 신규: pending → approved → processing → shipped (출고 = 완료) (3+1단계)
--      취소(cancelled) / 거절(rejected) / 반품(returned) 은 분기 종결 상태
--
-- 마이그레이션 전략:
--   - 기존 'ready'   → 'processing' (아직 처리 중인 것으로 간주)
--   - 기존 'shipping' → 'shipped'   (출고했으니 완료로 간주)
--   - 기존 'delivered' → 'shipped'  (도착 단계 폐기 — 출고된 거니까 동일)
-- ----------------------------------------------------------------------------

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 기존 데이터 마이그레이션 (CHECK 제약 풀린 동안)
UPDATE orders SET status = 'processing' WHERE status = 'ready';
UPDATE orders SET status = 'shipped'    WHERE status IN ('shipping', 'delivered');

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',     -- 승인 대기
    'approved',    -- 승인 완료
    'processing',  -- 처리 중 (생산·출고 준비)
    'shipped',     -- 출고 완료 (= 끝)
    'cancelled',   -- 취소
    'rejected',    -- 거절
    'returned'     -- 반품 (출고 후 하자 등)
  ));

-- ─── ② returns 테이블 신규 — 반품 이력 기록 ──────────────────────────────────
--
-- 출고 완료(shipped) 된 주문에서 물건 이상 발생 시 반품 처리.
-- restock=true 면 정상품으로 판단해 재고로 복원, false 면 폐기 처리.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  restock BOOLEAN DEFAULT false,        -- 정상품 → 재고 복원 여부
  return_date DATE DEFAULT CURRENT_DATE,
  memo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at DESC);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_returns" ON returns;
CREATE POLICY "admin_all_returns" ON returns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "chairman_read_returns" ON returns;
CREATE POLICY "chairman_read_returns" ON returns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'chairman'
    )
  );

-- 거래처는 자사 주문에 대한 반품 이력만 조회 가능
DROP POLICY IF EXISTS "cust_read_own_returns" ON returns;
CREATE POLICY "cust_read_own_returns" ON returns FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE o.id = returns.order_id
        AND up.role = 'customer'
        AND up.customer_id = o.customer_id
    )
  );

-- ─── ③ driver 역할 제거 — user_profiles CHECK 정리 ──────────────────────────
--
-- 기존 driver 사용자가 있으면 → admin 으로 일괄 전환 (운영 시스템에서 driver
-- 계정은 통상 운영 관리자가 겸직). 데이터 손실 없이 안전.
-- 새 CHECK 에서 'driver' 제거.
-- ----------------------------------------------------------------------------

UPDATE user_profiles SET role = 'admin' WHERE role = 'driver';

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('chairman', 'super_admin', 'admin', 'customer'));

-- driver 전용 RLS 정책 제거 — 더 이상 매칭될 사용자 없음.
DROP POLICY IF EXISTS "driver_read_deliveries"   ON deliveries;
DROP POLICY IF EXISTS "driver_update_deliveries" ON deliveries;
DROP POLICY IF EXISTS "driver_read_orders"       ON orders;

-- ─── ④ deliveries 테이블은 유지 ─────────────────────────────────────────────
--
-- 즉시 삭제하지 않는다. 향후 자체 배송 도입 시 재사용 가능.
-- driver_name / driver_phone / completion_photo_url 필드도 그대로 둠.
-- 현 시점에서는 신규 INSERT 가 발생하지 않으므로 dead-but-safe.
-- (필요 시 별도 마이그레이션에서 일괄 drop 가능)
-- ----------------------------------------------------------------------------

-- ─── ⑤ dispatch_order 함수 — 변경 없음 ──────────────────────────────────────
--
-- FIFO lot 차감 + inventory_logs(out) 생성 로직은 그대로 사용.
-- 호출 시점만 "shipping 진입" → "shipped 진입" 으로 클라이언트에서 변경.
-- ----------------------------------------------------------------------------

-- ─── 검증 쿼리 (선택 실행) ────────────────────────────────────────────────────
-- SELECT status, COUNT(*) FROM orders GROUP BY status;
-- SELECT role,   COUNT(*) FROM user_profiles GROUP BY role;
-- SELECT * FROM returns LIMIT 5;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 3 — 실시간 발행 (003) : 주문 변경을 관리자 화면에 즉시 반영          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ============================================================================
-- 003. 실시간(Realtime) 활성화 — orders / deliveries 변경을 관리자 화면에 즉시 반영
-- 적용: Supabase Dashboard → SQL Editor 에 붙여넣고 RUN
-- 전제: supabase_realtime 발행(publication)은 Supabase 기본 제공
-- RLS 는 그대로 적용됨 (admin/super_admin 은 admin_all_orders 로 전체 수신)
-- ============================================================================

-- orders 를 실시간 발행에 추가 (이미 추가돼 있으면 무시)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'orders 는 이미 supabase_realtime 에 포함됨';
END $$;

-- deliveries 도 함께 (배송 화면 실시간 확장 대비)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'deliveries 는 이미 supabase_realtime 에 포함됨';
END $$;

-- UPDATE/DELETE 시 변경 행 식별을 위해 전체 컬럼 복제 (선택이지만 권장)
ALTER TABLE orders     REPLICA IDENTITY FULL;
ALTER TABLE deliveries REPLICA IDENTITY FULL;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 4 — Storage 버킷 생성 + RLS 정책                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 버킷 생성 (Private). 이미 있으면 무시 — 대시보드 수동 생성 불필요
INSERT INTO storage.buckets (id, name, public)
VALUES ('customs-docs', 'customs-docs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-photos', 'delivery-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ── 수입신고필증 버킷 정책 ──────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════════
-- OMWIS — 수입신고필증 Storage 버킷 1회 셋업
-- ────────────────────────────────────────────────────────────────────────────
-- 사전 조건: Supabase Dashboard → Storage → New bucket
--   · Name: customs-docs
--   · Public: OFF (Private)
--   · File size limit: 10 MB (선택)
--   · Allowed MIME types: image/*, application/pdf
--
-- 그 후 이 SQL 을 SQL Editor 에 붙여넣고 Run — RLS 정책 설치.
-- ════════════════════════════════════════════════════════════════════════════

-- super_admin / admin: INSERT (업로드)
DROP POLICY IF EXISTS "storage_admin_upload_customs" ON storage.objects;
CREATE POLICY "storage_admin_upload_customs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'customs-docs'
    AND current_role_v() IN ('super_admin','admin')
  );

-- super_admin / admin / chairman: SELECT (열람)
DROP POLICY IF EXISTS "storage_read_customs" ON storage.objects;
CREATE POLICY "storage_read_customs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'customs-docs'
    AND current_role_v() IN ('super_admin','admin','chairman')
  );

-- super_admin / admin: DELETE (입고 취소 등)
DROP POLICY IF EXISTS "storage_admin_delete_customs" ON storage.objects;
CREATE POLICY "storage_admin_delete_customs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'customs-docs'
    AND current_role_v() IN ('super_admin','admin')
  );

-- ── 배송 완료 사진 버킷 정책 ────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════════
-- OMWIS — 배송 완료 사진 Storage 버킷 1회 셋업
-- ────────────────────────────────────────────────────────────────────────────
-- 사전 조건: Supabase Dashboard → Storage → New bucket
--   · Name: delivery-photos
--   · Public: OFF (Private)
--   · File size limit: 10 MB (선택)
--   · Allowed MIME types: image/*
--
-- 그 후 이 SQL 을 SQL Editor 에 붙여넣고 Run — RLS 정책 설치.
-- ════════════════════════════════════════════════════════════════════════════

-- driver / admin / super_admin: INSERT (사진 업로드)
DROP POLICY IF EXISTS "storage_upload_delivery_photos" ON storage.objects;
CREATE POLICY "storage_upload_delivery_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'delivery-photos'
    AND current_role_v() IN ('super_admin','admin','driver')
  );

-- driver / admin / super_admin / chairman / customer: SELECT
-- (거래처는 자사 주문에 한해 — RLS 가 deliveries 테이블에서 이미 필터)
DROP POLICY IF EXISTS "storage_read_delivery_photos" ON storage.objects;
CREATE POLICY "storage_read_delivery_photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-photos'
    AND current_role_v() IN ('super_admin','admin','driver','chairman','customer')
  );

-- super_admin / admin: DELETE
DROP POLICY IF EXISTS "storage_delete_delivery_photos" ON storage.objects;
CREATE POLICY "storage_delete_delivery_photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'delivery-photos'
    AND current_role_v() IN ('super_admin','admin')
  );


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 검증 — 아래 결과를 확인하세요                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
SELECT 'orders_status_check' AS check, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE conname = 'orders_status_check';
SELECT count(*) AS driver_remaining FROM user_profiles WHERE role = 'driver';      -- 0 이어야 정상
SELECT tablename AS realtime_tables FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1;
SELECT count(*) AS returns_table_ok FROM returns;
SELECT count(*) AS customer_prices_ok FROM customer_prices;
SELECT id AS storage_buckets FROM storage.buckets ORDER BY 1;
