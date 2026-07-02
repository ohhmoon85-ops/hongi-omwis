-- ════════════════════════════════════════════════════════════════════════════
-- OMWIS — IQC 검수 사진 Storage 버킷 셋업 (Phase 3 완결)
-- ────────────────────────────────────────────────────────────────────────────
-- 사전 조건: Supabase Dashboard → Storage → New bucket
--   · Name: inspection-photos
--   · Public: OFF (Private)
--   · File size limit: 10 MB (선택)
--   · Allowed MIME types: image/*
--
-- 그 후 이 SQL 을 SQL Editor 에 붙여넣고 Run — RLS 정책 설치.
-- ════════════════════════════════════════════════════════════════════════════

-- admin / super_admin: INSERT (검수 사진 업로드)
DROP POLICY IF EXISTS "storage_upload_inspection_photos" ON storage.objects;
CREATE POLICY "storage_upload_inspection_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND current_role_v() IN ('super_admin','admin')
  );

-- admin / super_admin / chairman: SELECT (반품 클레임·회장 조회)
-- 거래처는 자사 주문 관련만 볼 수 있어야 하나, MVP 단계에선 admin+chairman 만.
DROP POLICY IF EXISTS "storage_read_inspection_photos" ON storage.objects;
CREATE POLICY "storage_read_inspection_photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'inspection-photos'
    AND current_role_v() IN ('super_admin','admin','chairman')
  );

-- super_admin / admin: DELETE (오적재 정리 등)
DROP POLICY IF EXISTS "storage_delete_inspection_photos" ON storage.objects;
CREATE POLICY "storage_delete_inspection_photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inspection-photos'
    AND current_role_v() IN ('super_admin','admin')
  );
