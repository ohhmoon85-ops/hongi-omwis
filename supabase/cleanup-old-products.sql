-- ============================================================================
-- 구 데모/테스트 품목 4종 + 종속 데모 데이터 완전 삭제
-- 적용: Supabase Dashboard → SQL Editor 에 붙여넣고 RUN
-- ⚠️ 되돌릴 수 없음. 실 카탈로그(1050 H18 12종)는 건드리지 않음.
-- ----------------------------------------------------------------------------
-- 삭제 대상:
--   · 생 알루미늄 0.5mm × 1000mm  (구 데모)
--   · 지용성 코팅 0.3mm × 800mm   (구 데모)
--   · 수용성 코팅 0.3mm × 800mm   (구 데모)
--   · 생알 0.10 mm×540mm          (테스트)
-- 함께 정리: 위 품목이 걸린 데모 주문·재고·이력·안전재고·거래처단가
-- ============================================================================

BEGIN;

-- 대상 품목 id
CREATE TEMP TABLE _del_products ON COMMIT DROP AS
  SELECT id FROM products WHERE name IN (
    '생 알루미늄 0.5mm × 1000mm',
    '지용성 코팅 0.3mm × 800mm',
    '수용성 코팅 0.3mm × 800mm',
    '생알 0.10 mm×540mm'
  );

-- 이 품목이 들어간 주문(데모)
CREATE TEMP TABLE _del_orders ON COMMIT DROP AS
  SELECT DISTINCT order_id FROM order_items
  WHERE product_id IN (SELECT id FROM _del_products);

-- 주문을 참조하는 RESTRICT 관계 먼저 정리
DELETE FROM deliveries      WHERE order_id IN (SELECT order_id FROM _del_orders);
UPDATE inventory_logs SET order_id = NULL
  WHERE order_id IN (SELECT order_id FROM _del_orders);

-- 데모 주문 삭제 (order_items · invoices · returns 는 ON DELETE CASCADE)
DELETE FROM orders WHERE id IN (SELECT order_id FROM _del_orders);

-- 품목 직접 종속 정리 (inventory_logs → inventory 순서 준수)
DELETE FROM inventory_logs  WHERE product_id IN (SELECT id FROM _del_products);
DELETE FROM inventory       WHERE product_id IN (SELECT id FROM _del_products);
DELETE FROM safety_stock    WHERE product_id IN (SELECT id FROM _del_products);
DELETE FROM customer_prices WHERE product_id IN (SELECT id FROM _del_products);

-- 품목 삭제
DELETE FROM products WHERE id IN (SELECT id FROM _del_products);

COMMIT;

-- 검증: 남은 품목 (실 카탈로그 12종만 남아야 함)
SELECT type, count(*) FROM products GROUP BY type ORDER BY type;
