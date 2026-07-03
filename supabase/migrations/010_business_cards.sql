-- ============================================================================
-- 010_business_cards.sql
-- 명함 촬영·수집(Business Cards) 모듈 — 업체 발굴 확장
-- ----------------------------------------------------------------------------
-- 적용 방법: Supabase Dashboard → SQL Editor → 본 파일 붙여넣고 RUN
-- 의존: 008 (candidate_vendors)
-- 멱등: IF NOT EXISTS / DROP IF EXISTS 로 여러 번 실행해도 안전.
-- ----------------------------------------------------------------------------
-- 개념: 현장(박람회 등)에서 명함을 "찍고 끝" → 나중에 몰아서 업체로 정리.
--   status 흐름: unprocessed → processed(업체 연결) | discarded(버림, 복구 가능)
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_path TEXT NOT NULL,               -- Storage 내 경로 (business-cards 버킷)
  event_name VARCHAR(100),                -- 수집 행사 (예: 상하이 알루미늄展 2026)
  quick_memo VARCHAR(200),                -- 현장 한 줄 메모 (예: "부스 크고 응대 좋음")
  status VARCHAR(20) NOT NULL DEFAULT 'unprocessed'
    CHECK (status IN ('unprocessed','processed','discarded')),
  candidate_vendor_id UUID REFERENCES candidate_vendors(id) ON DELETE SET NULL,
  ocr_result JSONB,                       -- (선택) AI 인식 결과 캐시
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_cards_status ON business_cards(status);
CREATE INDEX IF NOT EXISTS idx_business_cards_captured_at ON business_cards(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_cards_vendor ON business_cards(candidate_vendor_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE business_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_business_cards" ON business_cards;
CREATE POLICY "admin_all_business_cards" ON business_cards FOR ALL
  USING (current_role_v() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "chair_read_business_cards" ON business_cards;
CREATE POLICY "chair_read_business_cards" ON business_cards FOR SELECT
  USING (current_role_v() = 'chairman');

-- ─── 검증 (선택) ────────────────────────────────────────────────────────────
-- SELECT status, count(*) FROM business_cards GROUP BY status;
