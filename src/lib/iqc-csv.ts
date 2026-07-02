// ============================================================================
// IQC 검수 이력 CSV 내보내기
// ----------------------------------------------------------------------------
// Excel 한글 호환을 위해 UTF-8 BOM(﻿) 을 앞에 붙임.
// 셀 안의 콤마·따옴표는 "" 이스케이프 처리.
// ============================================================================

import type { Inspection } from '@/types';

const HEADERS = [
  '검수일', '판정', 'SKU', '두께(mm)', '폭(mm)',
  '로트번호', '공급사', '코일수', '검수자',
  '두께 5점 측정',
  '실측 폭', '실측 중량',
  '공차(±mm)',
  '메모',
];

function esc(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  // 콤마·개행·따옴표 하나라도 있으면 "..." 로 감싸고 " 를 "" 로 이스케이프
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pointsToString(points: (number | null)[] | null): string {
  if (!points) return '';
  return points.map((p) => (p == null ? '-' : p.toFixed(3))).join(' / ');
}

export function inspectionsToCSV(items: Inspection[]): string {
  const rows = items.map((i) => [
    i.inspected_at,
    i.verdict === 'PASS' ? '합격' : '불합격',
    i.product_name ?? i.product_id,
    '',   // 두께/폭 컬럼은 product_name 안에 이미 포함되나 개별 컬럼 제공 시 확장
    '',
    i.lot_number,
    i.supplier ?? '',
    i.coil_count ?? '',
    i.inspector ?? '',
    pointsToString(i.thickness_points),
    i.width_measured ?? '',
    i.weight_measured ?? '',
    i.thickness_tol,
    i.memo ?? '',
  ].map(esc).join(','));

  const csv = ['﻿' + HEADERS.map(esc).join(','), ...rows].join('\r\n');
  return csv;
}

export function downloadCSV(items: Inspection[]) {
  const csv = inspectionsToCSV(items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `omwis_iqc_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
