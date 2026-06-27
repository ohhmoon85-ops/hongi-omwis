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
