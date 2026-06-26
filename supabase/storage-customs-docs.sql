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
