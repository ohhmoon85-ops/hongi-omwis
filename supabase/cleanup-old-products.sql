-- ============================================================================
-- 구 데모/테스트 품목 4종 + 종속 데모 데이터 완전 삭제  (임시테이블 없는 안전판)
-- 적용: Supabase Dashboard → SQL Editor 에 전체 붙여넣고 RUN → "Run without RLS"
-- ⚠️ 되돌릴 수 없음. 실 카탈로그(1050 H18 12종)는 건드리지 않음.
-- ----------------------------------------------------------------------------
-- ※ 이전 버전은 CREATE TEMP TABLE 을 썼는데, SQL Editor 가 문장별로 커밋하면서
--    ON COMMIT DROP 로 임시테이블이 사라져 "_del_products does not exist" 실패함.
--    → 이 버전은 서브쿼리만 사용해 그 문제를 원천 회피. 여러 번 실행해도 안전(멱등).
-- ----------------------------------------------------------------------------
-- 삭제 대상:
--   · 생 알루미늄 0.5mm × 1000mm  (구 데모)
--   · 지용성 코팅 0.3mm × 800mm   (구 데모)
--   · 수용성 코팅 0.3mm × 800mm   (구 데모)
--   · 생알 0.10 mm×540mm          (테스트)
-- ============================================================================

-- (선택) 먼저 이 SELECT만 드래그해서 실행 → 지워질 대상이 맞는지 눈으로 확인
SELECT id, name, type, is_active FROM products
WHERE name IN (
  '생 알루미늄 0.5mm × 1000mm',
  '지용성 코팅 0.3mm × 800mm',
  '수용성 코팅 0.3mm × 800mm',
  '생알 0.10 mm×540mm'
);

-- ---------------------------------------------------------------------------
BEGIN;

-- 1) 대상 품목이 포함된 데모 주문의 배송/재고이력 참조부터 정리
DELETE FROM deliveries
WHERE order_id IN (
  SELECT DISTINCT oi.order_id FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm')
);

UPDATE inventory_logs SET order_id = NULL
WHERE order_id IN (
  SELECT DISTINCT oi.order_id FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm')
);

-- 2) 데모 주문 삭제 (order_items · invoices · returns 는 ON DELETE CASCADE)
DELETE FROM orders
WHERE id IN (
  SELECT DISTINCT oi.order_id FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm')
);

-- 3) 품목 직접 종속 정리 (inventory_logs → inventory 순서 준수)
DELETE FROM inventory_logs  WHERE product_id IN (SELECT id FROM products WHERE name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm'));
DELETE FROM inventory       WHERE product_id IN (SELECT id FROM products WHERE name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm'));
DELETE FROM safety_stock    WHERE product_id IN (SELECT id FROM products WHERE name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm'));
DELETE FROM customer_prices WHERE product_id IN (SELECT id FROM products WHERE name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm'));

-- 4) 품목 삭제
DELETE FROM products
WHERE name IN ('생 알루미늄 0.5mm × 1000mm','지용성 코팅 0.3mm × 800mm','수용성 코팅 0.3mm × 800mm','생알 0.10 mm×540mm');

COMMIT;

-- 검증: 남은 품목 (실 카탈로그 12종만 → raw/oil/water 각 4개여야 함)
SELECT type, count(*) FROM products GROUP BY type ORDER BY type;
