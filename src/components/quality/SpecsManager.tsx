'use client';

// ============================================================================
// SpecsManager — 품목별 검수 기준 조정 (관리자 전용)
// 두께 공차 · 폭 허용 +/- · 중량 오차 % 를 품목별로 저장.
// 미설정 품목은 코드 상수(DEFAULT_SPEC) 로 폴백.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAllProducts } from '@/lib/products';
import {
  fetchAllInspectionSpecs, upsertInspectionSpec, DEFAULT_SPEC,
} from '@/lib/inspection-specs';
import { isDevMode } from '@/lib/dev-data';
import type { Product, InspectionSpec } from '@/types';
import { PRODUCT_TYPE_LABEL } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, ChevronLeft, Save } from 'lucide-react';

interface EditRow {
  thickness_tol: string;
  width_plus: string;
  width_minus: string;
  weight_tol_pct: string;
}

export function SpecsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [specs, setSpecs] = useState<Map<string, InspectionSpec>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [edits, setEdits] = useState<Map<string, EditRow>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);

  async function refresh() {
    if (isDevMode) { setLoaded(true); return; }
    try {
      const [ps, ss] = await Promise.all([fetchAllProducts(), fetchAllInspectionSpecs()]);
      setProducts(ps.filter((p) => p.is_active));
      setSpecs(ss);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조회 실패');
    } finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); }, []);

  function getEdit(pid: string): EditRow {
    const cached = edits.get(pid);
    if (cached) return cached;
    const s = specs.get(pid);
    return {
      thickness_tol: String(s?.thickness_tol ?? DEFAULT_SPEC.thickness_tol),
      width_plus:    String(s?.width_plus    ?? DEFAULT_SPEC.width_plus),
      width_minus:   String(s?.width_minus   ?? DEFAULT_SPEC.width_minus),
      weight_tol_pct:String(s?.weight_tol_pct?? DEFAULT_SPEC.weight_tol_pct),
    };
  }

  function updateEdit(pid: string, field: keyof EditRow, value: string) {
    const next = new Map(edits);
    next.set(pid, { ...getEdit(pid), [field]: value });
    setEdits(next);
  }

  async function save(p: Product) {
    const e = getEdit(p.id);
    const fields = {
      thickness_tol: parseFloat(e.thickness_tol),
      width_plus:    parseFloat(e.width_plus),
      width_minus:   parseFloat(e.width_minus),
      weight_tol_pct:parseFloat(e.weight_tol_pct),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (Number.isNaN(v) || v < 0) {
        toast.error(`${k} 값을 확인하세요`); return;
      }
    }
    setSaving(p.id);
    try {
      await upsertInspectionSpec(p.id, fields);
      toast.success(`${p.name} 검수 기준 저장`);
      // 캐시 초기화 + 재조회
      const nextEdits = new Map(edits);
      nextEdits.delete(p.id);
      setEdits(nextEdits);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally { setSaving(null); }
  }

  if (isDevMode) {
    return (
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
        <CardContent className="py-12 text-center text-sm text-amber-400">
          🛠️ 개발 모드 — 검수 기준은 Supabase 연결 시 편집 가능합니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Toaster position="top-center" />

      <div className="flex items-center justify-between mb-4">
        <Link href="/admin/quality" className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> 검수 이력
        </Link>
        <button onClick={refresh} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white mb-4">
        <CardContent className="py-3 text-xs text-gray-400">
          💡 미설정 품목은 <b className="text-gray-300">기본값</b> (두께 ±{DEFAULT_SPEC.thickness_tol}mm ·
          폭 +{DEFAULT_SPEC.width_plus}/-{DEFAULT_SPEC.width_minus}mm · 중량 ±{DEFAULT_SPEC.weight_tol_pct}%) 을 사용합니다.
          공급사·계약별로 다르면 여기서 품목별 조정하세요.
        </CardContent>
      </Card>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : products.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            판매중 품목이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const e = getEdit(p.id);
            const cur = specs.get(p.id);
            const isCustom = !!cur;
            return (
              <Card key={p.id} className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-300">
                      {PRODUCT_TYPE_LABEL[p.type]}
                    </span>
                    <span className="text-sm font-semibold">{p.name}</span>
                    {isCustom ? (
                      <span className="text-[10px] text-green-300">개별 기준 설정됨</span>
                    ) : (
                      <span className="text-[10px] text-gray-500">기본값 사용 중</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                    <SpecInput label="두께 공차 ±mm" value={e.thickness_tol}
                      onChange={(v) => updateEdit(p.id, 'thickness_tol', v)} />
                    <SpecInput label="폭 허용 +mm" value={e.width_plus}
                      onChange={(v) => updateEdit(p.id, 'width_plus', v)} />
                    <SpecInput label="폭 허용 -mm" value={e.width_minus}
                      onChange={(v) => updateEdit(p.id, 'width_minus', v)} />
                    <SpecInput label="중량 오차 %" value={e.weight_tol_pct}
                      onChange={(v) => updateEdit(p.id, 'weight_tol_pct', v)} />
                    <Button
                      onClick={() => save(p)}
                      disabled={saving === p.id}
                      className="h-10 bg-[#1a3d6b] hover:bg-[#235490] text-white"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {saving === p.id ? '저장 중...' : '저장'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function SpecInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-400">{label}</label>
      <Input
        type="number" inputMode="decimal" step="0.001"
        value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-[#0f1117] border-[#2a2f3e] text-white h-10 text-sm mt-1"
      />
    </div>
  );
}
