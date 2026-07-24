-- ============================================================================
-- 업체발굴(vendor evaluation) + 명함(business cards) 기능 완전 제거
-- 적용: Supabase Dashboard → SQL Editor 에 붙여넣고 RUN → "Run without RLS"
-- ⚠️ 되돌릴 수 없음. 품질검수(IQC)·재고·주문 등 나머지는 건드리지 않음.
-- ----------------------------------------------------------------------------
-- · candidate_vendors / business_cards 테이블 삭제 (CASCADE — 종속 관계 자동 정리)
-- · inspections 에 붙어 있던 vendor 확장 컬럼 3종 삭제 (IQC 는 이 컬럼을 더는 쓰지 않음)
-- · business-cards 스토리지 정책 삭제  (버킷 자체는 Dashboard 에서 수동 삭제)
-- ============================================================================

BEGIN;

-- 1) inspections 의 vendor 확장 컬럼 제거 (candidate_vendors FK 는 아래 DROP CASCADE 로 함께 정리)
ALTER TABLE inspections DROP COLUMN IF EXISTS candidate_vendor_id;
ALTER TABLE inspections DROP COLUMN IF EXISTS purpose;
ALTER TABLE inspections DROP COLUMN IF EXISTS commercial_snapshot;

-- 2) 테이블 삭제 (CASCADE: 인덱스·정책·남은 FK 자동 제거)
DROP TABLE IF EXISTS business_cards    CASCADE;
DROP TABLE IF EXISTS candidate_vendors CASCADE;

-- 3) business-cards 스토리지 RLS 정책 제거
DROP POLICY IF EXISTS "storage_upload_business_cards" ON storage.objects;
DROP POLICY IF EXISTS "storage_read_business_cards"   ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_business_cards" ON storage.objects;

COMMIT;

-- 검증: 두 테이블이 사라졌는지 (0 행이어야 정상)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('candidate_vendors','business_cards');

-- ----------------------------------------------------------------------------
-- 마지막 수동 단계: Dashboard → Storage → 'business-cards' 버킷 → Delete bucket
--   (버킷 안의 명함 사진도 함께 삭제됨. 되돌릴 수 없음)
-- ----------------------------------------------------------------------------
