// ============================================================================
// IQC 체크리스트 정의 — 성적서·외관 검수 항목
// ----------------------------------------------------------------------------
// 성적서(mill): 원산지 성적서와 실물 대조 항목 (수치·규격 등)
// 외관(look):   눈·손·측정도구로 확인하는 물리 상태 항목
//
// 2026-07-03: 실무 힌트 텍스트 보강 — 검수자가 "무엇을 어디서 확인해야 하는지"
// 를 각 항목 아래 한 줄로 표시.
// ============================================================================

import type { ProductType, ChecklistItem, CheckResult } from '@/types';

// 성적서 체크 — 모든 종류 공통 (1050 H18)
export const MILL_CHECKS: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '알루미늄 순도 Al ≥ 99.50%',        hint: '성적서 화학성분표 확인 (1050 규격)' },
  { q: '조직 H18 (완전경질) 표기',          hint: 'Temper 항목 — 완전경질 여부' },
  { q: '인장강도 기준 충족',                 hint: '1050-H18 기준: 대략 125 MPa 이상' },
  { q: '성적서-라벨-실물 로트 일치',         hint: '3자 대조 — 로트번호 완전 일치 확인' },
];

// 외관 체크 — 종류 무관 공통
export const LOOK_COMMON: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '스크래치·덴트 없음',                 hint: '표면 긁힘, 눌림 자국' },
  { q: '산화 백청·부식 없음',                hint: '흰 반점, 얼룩 (습기 노출 흔적)' },
  { q: '권취 상태 양호',                    hint: '핀들 스코핑(층 어긋남)·엣지 손상 없음' },
  { q: '포장·방습 상태 양호',                hint: '방습지 파손, 습기 침수 흔적 없음' },
];

// 생 알루미늄 (raw) 전용
export const LOOK_RAW: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '유분·오일 잔류 없음',               hint: '생알루미늄 표면 청결' },
];

// 지용성·수용성 코팅 (oil/water) 공통
export const LOOK_COATED: Readonly<Omit<ChecklistItem, 'r'>[]> = [
  { q: '코팅 균일 (얼룩·줄무늬 없음)',      hint: '조명 반사 검사 — 사면에서 관찰' },
  { q: '핀홀·기포 없음',                    hint: '코팅층 표면 결함' },
  { q: '코팅 밀림 없음',                    hint: '테이프 부착 후 밀림 감이 테스트' },
];

// 종류에 따라 최종 look 체크리스트 계산
export function buildLookChecks(type: ProductType): ChecklistItem[] {
  const extra = type === 'raw' ? LOOK_RAW : LOOK_COATED;
  return [...LOOK_COMMON, ...extra].map((c) => ({ ...c, r: null as CheckResult }));
}

export function buildMillChecks(): ChecklistItem[] {
  return MILL_CHECKS.map((c) => ({ ...c, r: null as CheckResult }));
}
