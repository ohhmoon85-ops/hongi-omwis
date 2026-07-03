-- ════════════════════════════════════════════════════════════════════════════
-- OMWIS — 명함 사진 Storage 버킷 셋업 (business-cards)
-- ────────────────────────────────────────────────────────────────────────────
-- 사전 조건: Supabase Dashboard → Storage → New bucket
--   · Name: business-cards
--   · Public: OFF (Private)
--   · File size limit: 10 MB (선택)
--   · Allowed MIME types: image/*
--
-- 그 후 이 SQL 을 SQL Editor 에 붙여넣고 Run — RLS 정책 설치.
-- (inspection-photos 와 동일한 권한 모델)
-- ════════════════════════════════════════════════════════════════════════════

-- super_admin / admin: INSERT (현장 명함 업로드)
DROP POLICY IF EXISTS "storage_upload_business_cards" ON storage.objects;
CREATE POLICY "storage_upload_business_cards"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-cards'
    AND current_role_v() IN ('super_admin','admin')
  );

-- super_admin / admin / chairman: SELECT (수집함 조회·회장 열람)
DROP POLICY IF EXISTS "storage_read_business_cards" ON storage.objects;
CREATE POLICY "storage_read_business_cards"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'business-cards'
    AND current_role_v() IN ('super_admin','admin','chairman')
  );

-- super_admin / admin: DELETE (버린 명함 정리 등)
DROP POLICY IF EXISTS "storage_delete_business_cards" ON storage.objects;
CREATE POLICY "storage_delete_business_cards"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-cards'
    AND current_role_v() IN ('super_admin','admin')
  );
