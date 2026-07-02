'use client';

// ============================================================================
// VendorList — 후보 업체 목록 (상태 필터 + JSON 임포트)
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDevVendors, createDevVendor } from '@/lib/dev-vendors';
import { fetchCandidateVendors, createCandidateVendor } from '@/lib/vendors';
import { saveDevInspection } from '@/lib/dev-inspections';
import { isDevMode } from '@/lib/dev-data';
import { formatDate } from '@/lib/utils';
import type { CandidateVendor, VendorStatus, Inspection, ChecklistItem } from '@/types';
import { VENDOR_STATUS_BADGE } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Plus, BarChart3, Upload, Building2 } from 'lucide-react';

const STATUS_FILTERS: Array<{ key: VendorStatus | 'all'; label: string }> = [
  { key: 'all',        label: '전체' },
  { key: 'evaluating', label: '평가 중' },
  { key: 'approved',   label: '승격 완료' },
  { key: 'on_hold',    label: '보류' },
  { key: 'rejected',   label: '탈락' },
];

export function VendorList() {
  const [items, setItems] = useState<CandidateVendor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<VendorStatus | 'all'>('all');
  const [importing, setImporting] = useState(false);

  async function refresh() {
    try {
      setItems(isDevMode ? loadDevVendors() : await fetchCandidateVendors());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조회 실패');
    } finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); }, []);

  async function importJson(file: File) {
    setImporting(true);
    try {
      const txt = await file.text();
      const list = JSON.parse(txt);
      if (!Array.isArray(list)) throw new Error('배열 형식이 아닙니다');
      const vdOnly = list.filter((r) => r.mode === 'vd' && r.vendor);
      if (vdOnly.length === 0) {
        toast.error('업체 평가 기록(mode="vd")이 없습니다');
        return;
      }
      const created = await importFable5Records(vdOnly);
      toast.success(`업체 ${created.vendors}개 + 평가 ${created.inspections}건 병합됨`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '임포트 실패');
    } finally { setImporting(false); }
  }

  const filtered = filter === 'all' ? items : items.filter((v) => v.status === filter);

  return (
    <>
      <Toaster position="top-center" />

      {/* 상단 액션 */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === f.key
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-[#171b26] text-gray-300 border-[#2a2f3e] hover:border-purple-500/40'
              }`}
            >
              {f.label}
              <span className="ml-1 text-gray-400 text-[10px]">
                ({f.key === 'all' ? items.length : items.filter((v) => v.status === f.key).length})
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/admin/vendors/compare">
            <Button variant="outline" className="border-[#c8962e]/40 text-[#e0bf70] hover:bg-[#c8962e]/10">
              <BarChart3 className="w-4 h-4 mr-1" /> 비교표
            </Button>
          </Link>
          <Link href="/admin/vendors/evaluate">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> 신규 샘플 평가
            </Button>
          </Link>
          <label className="inline-flex">
            <Button
              type="button"
              variant="outline"
              disabled={importing}
              onClick={() => document.getElementById('vendor-json-import')?.click()}
              className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
            >
              <Upload className="w-4 h-4 mr-1" />
              {importing ? '임포트 중...' : 'JSON 임포트'}
            </Button>
            <input
              id="vendor-json-import"
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
          </label>
          <button
            onClick={refresh}
            className="p-2 text-gray-400 hover:text-white"
            aria-label="새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            {items.length === 0
              ? '후보 업체가 없습니다. [신규 샘플 평가] 로 시작하거나 [JSON 임포트] 로 오프라인 백업 파일을 병합하세요.'
              : '해당 상태의 업체가 없습니다.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((v) => {
            const badge = VENDOR_STATUS_BADGE[v.status];
            return (
              <Link key={v.id} href={`/admin/vendors/${v.id}`}>
                <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] hover:ring-white/[0.10] cursor-pointer text-white">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-purple-300" />
                      <span className="text-base font-semibold">{v.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    {v.location && (
                      <div className="text-xs text-gray-400 mt-1">📍 {v.location}</div>
                    )}
                    <div className="text-[11px] text-gray-500 mt-2 space-y-0.5">
                      {v.price_note && <div>💰 {v.price_note}</div>}
                      {v.moq && <div>MOQ {v.moq}</div>}
                      {v.lead_time && <div>납기 {v.lead_time}</div>}
                      {v.payment_terms && <div>결제 {v.payment_terms}</div>}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-2 border-t border-[#1f2433] pt-2">
                      등록 {formatDate(v.created_at)}
                      {v.approved_at && ` · 승격 ${formatDate(v.approved_at)}`}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Fable5 오프라인 HTML 도구 JSON 백업 파싱 · 병합 ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Fable5Rec {
  mode: 'vd' | 'in';
  vendor?: { name: string; loc?: string; contact?: string; wechat?: string;
    price?: string; moq?: string; lead?: string; pay?: string };
  lot: string; type: string; thickness: number; width: number;
  points: string[]; widthM?: string; weightM?: string; tol: string;
  mill: Array<{ q: string; r: 'ok' | 'ng' | null }>;
  look: Array<{ q: string; r: 'ok' | 'ng' | null }>;
  supplier?: string; inspector?: string; memo?: string;
  verdict: 'PASS' | 'FAIL'; date: string; photos?: string[];
}

async function importFable5Records(recs: Fable5Rec[]): Promise<{ vendors: number; inspections: number }> {
  // 업체 dedupe: name+location 조합 키
  const vendorMap = new Map<string, CandidateVendor>();
  const existing = isDevMode ? loadDevVendors() : await fetchCandidateVendors();
  for (const v of existing) {
    vendorMap.set(`${v.name}|${v.location ?? ''}`, v);
  }

  let newVendors = 0;
  let newInspections = 0;

  for (const r of recs) {
    if (!r.vendor) continue;
    const key = `${r.vendor.name}|${r.vendor.loc ?? ''}`;
    let vendor = vendorMap.get(key);
    if (!vendor) {
      const input = {
        name: r.vendor.name,
        location: r.vendor.loc,
        contact_name: r.vendor.contact,
        wechat: r.vendor.wechat,
        price_note: r.vendor.price,
        moq: r.vendor.moq,
        lead_time: r.vendor.lead,
        payment_terms: r.vendor.pay,
      };
      vendor = isDevMode ? createDevVendor(input) : await createCandidateVendor(input);
      vendorMap.set(key, vendor);
      newVendors++;
    }

    // Inspection 도 등록 (dev 만 — 운영은 API 없이 직접 저장 불가)
    if (isDevMode) {
      const points = r.points.map((p) => (p === '' ? null : parseFloat(p)));
      const buildChecks = (arr: Fable5Rec['mill']): ChecklistItem[] =>
        arr.map((m) => ({ q: m.q, hint: undefined, r: m.r }));
      const insp: Inspection = {
        id: crypto.randomUUID(),
        inventory_id: null,
        product_id: `dev-${skuTypeCode(r.type)}-${String(Math.round(r.thickness * 100)).padStart(3, '0')}-${r.width}`,
        product_name: `${r.type} ${r.thickness.toFixed(2)}mm × ${r.width}mm`,
        lot_number: r.lot,
        supplier: r.vendor.name,
        coil_count: null,
        inspector: r.inspector ?? null,
        inspected_at: r.date,
        thickness_points: points,
        thickness_tol: parseFloat(r.tol) || 0.005,
        width_measured: r.widthM ? parseFloat(r.widthM) : null,
        weight_measured: r.weightM ? parseFloat(r.weightM) : null,
        mill_checks: buildChecks(r.mill),
        look_checks: buildChecks(r.look),
        photo_urls: [],
        memo: r.memo ?? null,
        verdict: r.verdict,
        purpose: 'vendor_sample',
        candidate_vendor_id: vendor.id,
        candidate_vendor_name: vendor.name,
        commercial_snapshot: {
          price_note: r.vendor.price ?? undefined,
          moq: r.vendor.moq ?? undefined,
          lead_time: r.vendor.lead ?? undefined,
          payment_terms: r.vendor.pay ?? undefined,
        },
        created_at: new Date().toISOString(),
      };
      saveDevInspection(insp);
      newInspections++;
    }

    // 운영 모드에서도 벤더는 등록되지만 검수는 별도 API 필요 (후속 이터레이션)
    if (!isDevMode) {
      // 운영 벤더는 이미 위에서 createCandidateVendor 로 등록됨
      // 검수 저장은 skip — 운영자는 웹 UI 에서 재입력 권장
    }
  }
  return { vendors: newVendors, inspections: newInspections };
}

function skuTypeCode(name: string): string {
  if (name.includes('생')) return 'raw';
  if (name.includes('지용성')) return 'oil';
  return 'water';
}
