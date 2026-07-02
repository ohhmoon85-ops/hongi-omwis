-- ============================================================================
-- 008_vendor_evaluation.sql
-- 업체 발굴 평가(Vendor Evaluation) 모듈 — Phase 3 확장
-- ----------------------------------------------------------------------------
-- 적용 방법: Supabase Dashboard → SQL Editor → 본 파일 붙여넣고 RUN
-- 의존: 001~007 (특히 007 inspections 테이블)
-- 멱등: DROP IF EXISTS + CREATE 로 여러 번 실행해도 안전.
-- ============================================================================

-- ─── ① candidate_vendors — 후보 업체 (정식 공급사와 별도) ─────────────────
CREATE TABLE IF NOT EXISTS candidate_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,            -- 업체명 (중문 가능)
  location VARCHAR(100),                 -- 소재지 (예: 광둥성 포산)
  contact_name VARCHAR(50),
  wechat VARCHAR(50),                    -- WeChat ID (중국 현지 연락수단)
  phone VARCHAR(30),
  email VARCHAR(100),
  -- 상용 조건 (평가 시점 스냅샷은 inspections 쪽에도 저장)
  price_note VARCHAR(100),               -- 자유 입력: "USD 2,450/t"
  moq VARCHAR(50),                       -- "5t"
  lead_time VARCHAR(50),                 -- "30일"
  payment_terms VARCHAR(100),            -- "T/T 30/70"
  factory_note TEXT,                     -- 공장 규모·설비·인증
  status VARCHAR(20) DEFAULT 'evaluating'
    CHECK (status IN ('evaluating','approved','rejected','on_hold')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  memo TEXT,                             -- 승격/탈락 사유 등
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_vendors_status ON candidate_vendors(status);
CREATE INDEX IF NOT EXISTS idx_candidate_vendors_created_at ON candidate_vendors(created_at DESC);

-- ─── ② inspections 확장 — 검수 목적 구분 + 후보 업체 연결 ────────────────
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) DEFAULT 'incoming'
    CHECK (purpose IN ('incoming','vendor_sample')),
  ADD COLUMN IF NOT EXISTS candidate_vendor_id UUID
    REFERENCES candidate_vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commercial_snapshot JSONB;
  -- commercial_snapshot: {price_note, moq, lead_time, payment_terms}
  -- 평가 시점 조건을 스냅샷으로 보존 — 업체가 조건 변경해도 원 평가 조건 유지

CREATE INDEX IF NOT EXISTS idx_inspections_purpose ON inspections(purpose);
CREATE INDEX IF NOT EXISTS idx_inspections_candidate_vendor ON inspections(candidate_vendor_id);

-- ─── ③ RLS ────────────────────────────────────────────────────────────────
ALTER TABLE candidate_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_candidate_vendors" ON candidate_vendors;
CREATE POLICY "admin_all_candidate_vendors" ON candidate_vendors FOR ALL
  USING (current_role_v() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "chair_read_candidate_vendors" ON candidate_vendors;
CREATE POLICY "chair_read_candidate_vendors" ON candidate_vendors FOR SELECT
  USING (current_role_v() = 'chairman');

-- ─── 검증 (선택) ──────────────────────────────────────────────────────────
-- SELECT status, count(*) FROM candidate_vendors GROUP BY status;
-- SELECT purpose, count(*) FROM inspections GROUP BY purpose;
