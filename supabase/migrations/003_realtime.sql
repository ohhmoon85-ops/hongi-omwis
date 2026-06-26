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
