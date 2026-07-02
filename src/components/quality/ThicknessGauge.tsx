'use client';

// ============================================================================
// ThicknessGauge — 두께 5점 입력 + 실시간 합/불 표시
// ----------------------------------------------------------------------------
// 좌상 · 좌중 · 중앙 · 우중 · 우하 5점 측정을 시각화.
// 각 점: 기준±공차 벗어나면 빨강, 정상이면 초록, 미입력이면 회색.
// 하단에 통계(평균/최소/최대) + 최종 판정 힌트.
// ============================================================================

import { thicknessStats } from '@/lib/iqc-verdict';
import { Input } from '@/components/ui/input';

const POINT_LABELS = ['좌상', '좌중', '중앙', '우중', '우하'];

interface Props {
  target: number;                    // 기준 두께 mm
  tolerance: number;                 // ± mm
  values: (number | null)[];         // 5점
  onChange: (values: (number | null)[]) => void;
}

function pointStatus(v: number | null, min: number, max: number): 'ok' | 'ng' | 'empty' {
  if (v == null || Number.isNaN(v)) return 'empty';
  return v >= min && v <= max ? 'ok' : 'ng';
}

const TONE = {
  ok:    'bg-green-500/15 text-green-300 border-green-500/40',
  ng:    'bg-red-500/15 text-red-300 border-red-500/40 animate-pulse',
  empty: 'bg-[#0f1117] text-gray-300 border-[#2a2f3e]',
};

export function ThicknessGauge({ target, tolerance, values, onChange }: Props) {
  const min = target - tolerance;
  const max = target + tolerance;

  function setPoint(idx: number, v: string) {
    const parsed = v.trim() === '' ? null : parseFloat(v);
    const next = [...values];
    next[idx] = parsed != null && !Number.isNaN(parsed) ? parsed : null;
    onChange(next);
  }

  const stats = thicknessStats(values);

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400">
        기준 <b className="text-white">{target.toFixed(3)}mm</b> ±{tolerance.toFixed(3)}
        <span className="ml-2">
          허용 <b className="text-gray-200">{min.toFixed(3)}</b> ~ <b className="text-gray-200">{max.toFixed(3)}</b>
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {POINT_LABELS.map((label, i) => {
          const status = pointStatus(values[i], min, max);
          return (
            <div key={i} className="text-center">
              <div className="text-[10px] text-gray-500 mb-1">{label}</div>
              <Input
                type="number"
                inputMode="decimal"
                step="0.001"
                value={values[i] ?? ''}
                onChange={(e) => setPoint(i, e.target.value)}
                placeholder="—"
                className={`h-11 text-center text-sm font-mono border ${TONE[status]}`}
              />
            </div>
          );
        })}
      </div>
      {stats && (
        <div className="text-[11px] text-gray-400 flex gap-4">
          <span>측정 {stats.count}/5</span>
          <span>평균 {stats.avg.toFixed(3)}mm</span>
          <span>최소 {stats.min.toFixed(3)}</span>
          <span>최대 {stats.max.toFixed(3)}</span>
        </div>
      )}
      {!stats && (
        <div className="text-[11px] text-gray-500">
          측정값 미입력 — 장비 없으면 스킵 가능. (성적서·외관만으로 판정)
        </div>
      )}
    </div>
  );
}
