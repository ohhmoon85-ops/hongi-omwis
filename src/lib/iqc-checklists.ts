// ============================================================================
// IQC 체크리스트 정의 — 성적서·외관 검수 항목
// ----------------------------------------------------------------------------
// 성적서(mill): 원산지 성적서와 실물 대조 항목 (수치·규격 등)
// 외관(look):   눈·손·측정도구로 확인하는 물리 상태 항목
// ============================================================================

import type { ProductType, ChecklistItem, CheckResult } from '@/types';

// 성적서 체크 — 모든 종류 공통 (1050 H18)
export const MILL_CHECKS: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '알루미늄 순도 Al ≥ 99.50%',       hint: '성적서 화학성분표' },
  { q: '조직 H18 (완전경질) 표기',         hint: 'Temper 항목 확인' },
  { q: '인장강도 기준 충족',                hint: '1050-H18 기준' },
  { q: '성적서-라벨-실물 로트 일치',        hint: '3자 대조' },
];

// 외관 체크 — 종류 무관 공통
export const LOOK_COMMON: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '스크래치·덴트 없음' },
  { q: '산화 백청·부식 없음' },
  { q: '권취 상태 양호 (핀들 스코핑·엣지 손상 없음)' },
  { q: '포장·방습 상태 양호' },
];

// 생 알루미늄 (raw) 전용
export const LOOK_RAW: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '유분·오일 잔류 없음' },
];

// 지용성·수용성 코팅 (oil/water) 공통
export const LOOK_COATED: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '코팅 균일 (얼룩·줄무늬 없음)' },
  { q: '핀홀·기포 없음' },
  { q: '코팅 밀림 없음 (테이프 감이 테스트)' },
];

// 종류에 따라 최종 look 체크리스트 계산
export function buildLookChecks(type: ProductType): ChecklistItem[] {
  const extra = type === 'raw' ? LOOK_RAW : LOOK_COATED;
  return [...LOOK_COMMON, ...extra].map((c) => ({ ...c, r: null as CheckResult }));
}

export function buildMillChecks(): ChecklistItem[] {
  return MILL_CHECKS.map((c) => ({ ...c, r: null as CheckResult }));
}
