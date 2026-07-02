'use client';

// ============================================================================
// SkuSelector — 12 SKU 프리셋 그리드 (종류별 3그룹 × 4개)
// 검수 화면 STEP 0. 선택 시 검수 폼의 기준값(target thickness/width) 세팅.
// ============================================================================

import { groupPresets } from '@/lib/iqc-presets';
import type { IqcSkuPreset, ProductType } from '@/types';
import { PRODUCT_TYPE_LABEL } from '@/types';

const TYPE_ICON: Record<ProductType, string> = { raw: '🪙', oil: '🛢️', water: '💧' };
const TYPE_ORDER: ProductType[] = ['raw', 'oil', 'water'];

const TYPE_TONE: Record<ProductType, string> = {
  raw:   'from-slate-500/20 to-slate-500/5 border-slate-500/40 hover:border-slate-400',
  oil:   'from-amber-500/20 to-amber-500/5 border-amber-500/40 hover:border-amber-400',
  water: 'from-blue-500/20 to-blue-500/5 border-blue-500/40 hover:border-blue-400',
};

interface Props {
  value: IqcSkuPreset | null;
  onSelect: (p: IqcSkuPreset) => void;
}

export function SkuSelector({ value, onSelect }: Props) {
  const grouped = groupPresets();
  return (
    <div className="space-y-4">
      {TYPE_ORDER.map((t) => (
        <div key={t}>
          <div className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
            <span>{TYPE_ICON[t]}</span>
            <span>{PRODUCT_TYPE_LABEL[t]}</span>
            <span className="text-gray-500 font-normal">(1050 H18)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {grouped[t].map((p) => {
              const selected = value?.code === p.code;
              return (
                <button
                  key={p.code}
                  onClick={() => onSelect(p)}
                  type="button"
                  className={`p-3 rounded-lg border bg-gradient-to-br text-left transition ${
                    selected
                      ? 'from-[#c8962e]/25 to-[#c8962e]/5 border-[#c8962e] ring-2 ring-[#c8962e]/40'
                      : TYPE_TONE[t]
                  }`}
                >
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {p.code}
                  </div>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {p.thickness.toFixed(2)} × {p.width}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    두께 mm × 폭 mm
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
