// ============================================================================
// IQC 12 SKU 프리셋 — 검수 화면에서 빠른 선택용
// ----------------------------------------------------------------------------
// products 테이블에 seed-real-products.sql 로 등록된 12종의 규격을 표시.
// SkuSelector 그리드가 이 프리셋을 렌더링 → 선택 시 검수 폼 자동 설정.
// ============================================================================

import type { IqcSkuPreset, ProductType } from '@/types';

const PURITY = '1050 H18 (99.5%↑)';

export const IQC_PRESETS: readonly IqcSkuPreset[] = [
  // 생 알루미늄 4종
  { code: 'raw-010-540', type: 'raw', thickness: 0.10, width: 540, purity: PURITY, displayName: '생 0.10 × 540' },
  { code: 'raw-010-630', type: 'raw', thickness: 0.10, width: 630, purity: PURITY, displayName: '생 0.10 × 630' },
  { code: 'raw-012-540', type: 'raw', thickness: 0.12, width: 540, purity: PURITY, displayName: '생 0.12 × 540' },
  { code: 'raw-012-630', type: 'raw', thickness: 0.12, width: 630, purity: PURITY, displayName: '생 0.12 × 630' },
  // 지용성 4종
  { code: 'oil-015-540', type: 'oil', thickness: 0.15, width: 540, purity: PURITY, displayName: '지용성 0.15 × 540' },
  { code: 'oil-015-630', type: 'oil', thickness: 0.15, width: 630, purity: PURITY, displayName: '지용성 0.15 × 630' },
  { code: 'oil-017-540', type: 'oil', thickness: 0.17, width: 540, purity: PURITY, displayName: '지용성 0.17 × 540' },
  { code: 'oil-017-630', type: 'oil', thickness: 0.17, width: 630, purity: PURITY, displayName: '지용성 0.17 × 630' },
  // 수용성 4종
  { code: 'water-015-540', type: 'water', thickness: 0.15, width: 540, purity: PURITY, displayName: '수용성 0.15 × 540' },
  { code: 'water-015-630', type: 'water', thickness: 0.15, width: 630, purity: PURITY, displayName: '수용성 0.15 × 630' },
  { code: 'water-017-540', type: 'water', thickness: 0.17, width: 540, purity: PURITY, displayName: '수용성 0.17 × 540' },
  { code: 'water-017-630', type: 'water', thickness: 0.17, width: 630, purity: PURITY, displayName: '수용성 0.17 × 630' },
];

// 종류별 그룹핑 (SkuSelector 그리드 렌더링에 사용)
export function groupPresets(): Record<ProductType, IqcSkuPreset[]> {
  return {
    raw:   IQC_PRESETS.filter((p) => p.type === 'raw'),
    oil:   IQC_PRESETS.filter((p) => p.type === 'oil'),
    water: IQC_PRESETS.filter((p) => p.type === 'water'),
  };
}

// SKU 이름 → products.name 매칭 (검수 저장 시 product_id 조회용).
// seed-real-products.sql 의 name 규칙과 일치해야 함.
export function presetToProductName(p: IqcSkuPreset): string {
  const thick = p.thickness.toFixed(2);
  switch (p.type) {
    case 'raw':   return `생알미늄 1050 H18 ${thick}mm × ${p.width}mm`;
    case 'oil':   return `지용성 코팅 ${thick}mm × ${p.width}mm`;
    case 'water': return `수용성 코팅 ${thick}mm × ${p.width}mm`;
  }
}
