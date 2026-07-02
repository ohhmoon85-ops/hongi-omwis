'use client';

// ============================================================================
// TriCheck — 체크리스트 1행: 이상 없음(OK) / 불량(NG) / 스킵(미확인)
// ----------------------------------------------------------------------------
// 대량 체크리스트를 빠르게 처리할 수 있도록 큰 버튼 3개로 구성.
// r=null 이면 어느 버튼도 안 눌린 상태. 저장 전 null 존재 시 PENDING 경고.
// ============================================================================

import type { ChecklistItem, CheckResult } from '@/types';
import { Check, X, Minus } from 'lucide-react';

interface Props {
  item: ChecklistItem;
  onChange: (r: CheckResult) => void;
}

const BTN_BASE = 'flex-1 h-10 rounded-md text-xs font-semibold border transition-colors flex items-center justify-center gap-1';

export function TriCheck({ item, onChange }: Props) {
  const isOk  = item.r === 'ok';
  const isNg  = item.r === 'ng';
  const isNul = item.r === null;

  return (
    <div className="p-3 rounded-lg border border-[#1f2433] bg-[#0f1117]">
      <div className="text-sm text-gray-200">{item.q}</div>
      {item.hint && (
        <div className="text-[10px] text-gray-500 mt-0.5">{item.hint}</div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => onChange('ok')}
          className={`${BTN_BASE} ${isOk
            ? 'bg-green-500/30 text-green-200 border-green-500'
            : 'bg-transparent text-gray-400 border-[#2a2f3e] hover:border-green-500/50 hover:text-green-300'}`}
        >
          <Check className="w-4 h-4" /> 이상 없음
        </button>
        <button
          type="button"
          onClick={() => onChange('ng')}
          className={`${BTN_BASE} ${isNg
            ? 'bg-red-500/30 text-red-200 border-red-500'
            : 'bg-transparent text-gray-400 border-[#2a2f3e] hover:border-red-500/50 hover:text-red-300'}`}
        >
          <X className="w-4 h-4" /> 불량
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`${BTN_BASE} ${isNul
            ? 'bg-gray-500/30 text-gray-200 border-gray-500'
            : 'bg-transparent text-gray-500 border-[#2a2f3e] hover:border-gray-500 hover:text-gray-300'}`}
        >
          <Minus className="w-4 h-4" /> 스킵
        </button>
      </div>
    </div>
  );
}
