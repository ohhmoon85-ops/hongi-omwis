-- ============================================================================
-- 007_iqc_module.sql
-- 입고 품질검수(IQC) 모듈 — Phase 3 첫 착수
-- ----------------------------------------------------------------------------
-- 적용 방법: Supabase Dashboard → SQL Editor → 본 파일 전체 붙여넣고 RUN
-- 의존: 001~006 (특히 006 purity 컬럼)
-- 멱등: DROP IF EXISTS + CREATE 로 여러 번 실행해도 안전.
-- ============================================================================

-- ─── ① inspections — 검수 기록 ────────────────────────────────────────────
-- 입고 1건당 1검수. verdict='PASS' 시에만 inventory 에 연결된 lot 생성.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- PASS 시 이 검수로 만들어진 재고 lot 참조 (FAIL/PENDING 이면 NULL)
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  lot_number VARCHAR(50) NOT NULL,        -- 원산지 성적서 번호
  supplier VARCHAR(100),                  -- 공급사 (예: 中國 XX Aluminium)
  coil_count INTEGER,                     -- 코일 수
  inspector VARCHAR(50),                  -- 검수자 이름
  inspected_at DATE DEFAULT CURRENT_DATE,

  -- 치수 측정 (장비 없을 때 NULL 허용)
  thickness_points DECIMAL(6,3)[],        -- 5점 [좌상,좌중,중앙,우중,우하]
  thickness_tol DECIMAL(6,3) DEFAULT 0.005,-- 두께 공차 ±mm
  width_measured DECIMAL(7,2),            -- 실측 폭 (허용 +1/-0)
  weight_measured DECIMAL(10,2),          -- 실측 중량 kg

  -- 체크리스트 결과 (JSONB)
  mill_checks JSONB,     -- [{q:"순도 Al≥99.50%", r:"ok|ng|null"}, ...]
  look_checks JSONB,     -- [{q:"스크래치 없음", r:"ok|ng|null"}, ...]

  photo_urls TEXT[],     -- Supabase Storage 경로 배열
  memo TEXT,
  verdict VARCHAR(10) NOT NULL CHECK (verdict IN ('PASS','FAIL')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspections_product_id ON inspections(product_id);
CREATE INDEX IF NOT EXISTS idx_inspections_lot_number ON inspections(lot_number);
CREATE INDEX IF NOT EXISTS idx_inspections_supplier ON inspections(supplier);
CREATE INDEX IF NOT EXISTS idx_inspections_inspected_at ON inspections(inspected_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_verdict ON inspections(verdict);

-- ─── ② inspection_specs — 품목별 검수 기준 (관리자 조정 가능) ─────────────
CREATE TABLE IF NOT EXISTS inspection_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) UNIQUE,
  thickness_tol DECIMAL(6,3) DEFAULT 0.005,  -- 두께 공차 ±
  width_plus DECIMAL(5,2) DEFAULT 1.0,       -- 폭 허용 +
  width_minus DECIMAL(5,2) DEFAULT 0.0,      -- 폭 허용 -
  weight_tol_pct DECIMAL(4,2) DEFAULT 0.5,   -- 중량 오차 %
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ③ returns.inspection_id — 반품 시 원 검수 역추적 ─────────────────────
ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspection_id UUID
  REFERENCES inspections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_returns_inspection_id ON returns(inspection_id);

-- ─── ④ RLS ────────────────────────────────────────────────────────────────
ALTER TABLE inspections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_inspections" ON inspections;
CREATE POLICY "admin_all_inspections" ON inspections FOR ALL
  USING (current_role_v() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "chair_read_inspections" ON inspections;
CREATE POLICY "chair_read_inspections" ON inspections FOR SELECT
  USING (current_role_v() = 'chairman');

DROP POLICY IF EXISTS "admin_all_inspection_specs" ON inspection_specs;
CREATE POLICY "admin_all_inspection_specs" ON inspection_specs FOR ALL
  USING (current_role_v() IN ('super_admin','admin'));

DROP POLICY IF EXISTS "chair_read_inspection_specs" ON inspection_specs;
CREATE POLICY "chair_read_inspection_specs" ON inspection_specs FOR SELECT
  USING (current_role_v() = 'chairman');

-- ─── 검증 (선택 실행) ─────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM inspections;
-- SELECT policyname FROM pg_policies WHERE tablename IN ('inspections','inspection_specs');
