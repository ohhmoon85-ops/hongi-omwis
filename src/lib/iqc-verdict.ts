// ============================================================================
// IQC 자동 판정 — PASS / FAIL / PENDING
// ----------------------------------------------------------------------------
// 규칙 (지시문 §4):
//   1) 두께: 입력된 측정점 중 하나라도 [기준±공차] 벗어나면 FAIL
//      → 측정 미입력(장비 없음)은 감점 없음 (모든 점 null 이면 두께 검증 스킵)
//   2) 폭: 실측 있으면 [기준, 기준+plus] 범위 벗어나면 FAIL
//      → 미입력은 스킵
//   3) 체크리스트: 하나라도 'ng' → FAIL
//   4) 체크리스트 미완료(null 하나라도 존재) → PENDING (저장 전 확인 필요)
//   5) 모두 통과 → PASS
// ============================================================================

import type { ChecklistItem, Verdict } from '@/types';

export interface VerdictInput {
  targetThickness: number;      // 기준 두께 (mm) — SKU 프리셋 값
  thicknessTol: number;         // 공차 ± (mm)
  thicknessPoints: (number | null)[]; // 5점 (null 허용)
  targetWidth: number;          // 기준 폭 (mm)
  widthPlus: number;            // 허용 +
  widthMinus: number;           // 허용 - (통상 0)
  widthMeasured: number | null;
  millChecks: ChecklistItem[];
  lookChecks: ChecklistItem[];
}

export interface VerdictResult {
  verdict: Verdict;
  reasons: string[];            // FAIL 시 사람이 읽는 사유 목록
}

export function computeVerdict(v: VerdictInput): VerdictResult {
  const reasons: string[] = [];

  // 1) 두께 — 입력된 점만 검증
  const validPoints = v.thicknessPoints
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p != null && !Number.isNaN(x.p as number));
  if (validPoints.length > 0) {
    const min = v.targetThickness - v.thicknessTol;
    const max = v.targetThickness + v.thicknessTol;
    for (const { p, i } of validPoints) {
      const point = p as number;
      if (point < min || point > max) {
        reasons.push(
          `두께 P${i + 1}=${point.toFixed(3)}mm (기준 ${v.targetThickness}±${v.thicknessTol})`,
        );
      }
    }
  }

  // 2) 폭 — 실측 있을 때만
  if (v.widthMeasured != null && !Number.isNaN(v.widthMeasured)) {
    const lo = v.targetWidth - v.widthMinus;
    const hi = v.targetWidth + v.widthPlus;
    if (v.widthMeasured < lo || v.widthMeasured > hi) {
      reasons.push(
        `폭 실측=${v.widthMeasured}mm (기준 ${v.targetWidth} +${v.widthPlus}/-${v.widthMinus})`,
      );
    }
  }

  // 3) 체크리스트 'ng'
  const allChecks = [...v.millChecks, ...v.lookChecks];
  for (const c of allChecks) {
    if (c.r === 'ng') reasons.push(`체크리스트 실패: ${c.q}`);
  }

  if (reasons.length > 0) return { verdict: 'FAIL', reasons };

  // 4) 미완료 항목
  const hasUnchecked = allChecks.some((c) => c.r === null);
  if (hasUnchecked) return { verdict: 'PENDING', reasons: ['체크리스트 미완료 항목 있음'] };

  // 5) 모두 통과
  return { verdict: 'PASS', reasons: [] };
}

// UI 편의: 두께 5점의 통계 (평균/최소/최대)
export function thicknessStats(points: (number | null)[]) {
  const nums = points.filter((p): p is number => p != null && !Number.isNaN(p));
  if (nums.length === 0) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
  return { min, max, avg, count: nums.length };
}
