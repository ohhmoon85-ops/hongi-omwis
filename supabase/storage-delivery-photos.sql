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

-- admin / super_admin: INSERT (사진 업로드)
-- driver 역할은 2026-06-27 배송 모델 단순화에서 폐기됨 — 본 정책에서도 제거.
DROP POLICY IF EXISTS "storage_upload_delivery_photos" ON storage.objects;
CREATE POLICY "storage_upload_delivery_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'delivery-photos'
    AND current_role_v() IN ('super_admin','admin')
  );

-- admin / super_admin / chairman / customer: SELECT
-- (거래처는 자사 주문에 한해 — RLS 가 deliveries 테이블에서 이미 필터)
DROP POLICY IF EXISTS "storage_read_delivery_photos" ON storage.objects;
CREATE POLICY "storage_read_delivery_photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-photos'
    AND current_role_v() IN ('super_admin','admin','chairman','customer')
  );

-- super_admin / admin: DELETE
DROP POLICY IF EXISTS "storage_delete_delivery_photos" ON storage.objects;
CREATE POLICY "storage_delete_delivery_photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'delivery-photos'
    AND current_role_v() IN ('super_admin','admin')
  );
