'use client';

// ============================================================================
// VendorSampleWizard — 후보 업체 샘플 IQC 평가 4단계
// ----------------------------------------------------------------------------
// STEP 0: 후보 업체 선택 (VendorSelector)
// STEP 1: SKU 프리셋
// STEP 2: 검수 입력 (SkuSelector/ThicknessGauge/TriCheck 재사용 — IQC 와 동일)
// STEP 3: 저장 완료 → [비교표로 이동] / [다음 평가]  (재고 등록 없음)
// ============================================================================

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isDevMode } from '@/lib/dev-data';
import { saveDevInspection } from '@/lib/dev-inspections';
import { buildMillChecks, buildLookChecks } from '@/lib/iqc-checklists';
import { computeVerdict } from '@/lib/iqc-verdict';
import { presetToProductName } from '@/lib/iqc-presets';
import type {
  IqcSkuPreset, ChecklistItem, CheckResult, Inspection, Verdict,
  CandidateVendor, CommercialSnapshot,
} from '@/types';
import { VERDICT_BADGE } from '@/types';
import { SkuSelector } from '@/components/quality/SkuSelector';
import { ThicknessGauge } from '@/components/quality/ThicknessGauge';
import { TriCheck } from '@/components/quality/TriCheck';
import { VendorSelector } from './VendorSelector';
import {
  ClipboardCheck, ChevronRight, ArrowLeft, CheckCircle2, AlertTriangle,
  Building2, BarChart3,
} from 'lucide-react';

const DEFAULT_TOL = 0.005;
const DEFAULT_WIDTH_PLUS = 1.0;
const DEFAULT_WIDTH_MINUS = 0.0;

type Step = 'vendor' | 'sku' | 'inspect' | 'saved';

export function VendorSampleWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('vendor');
  const [vendor, setVendor] = useState<CandidateVendor | null>(null);
  const [preset, setPreset] = useState<IqcSkuPreset | null>(null);

  // 검수 폼
  const [sampleNumber, setSampleNumber] = useState('');
  const [inspector, setInspector] = useState('');
  const [thicknessPoints, setThicknessPoints] = useState<(number | null)[]>(
    [null, null, null, null, null],
  );
  const [widthMeasured, setWidthMeasured] = useState('');
  const [weightMeasured, setWeightMeasured] = useState('');
  const [millChecks, setMillChecks] = useState<ChecklistItem[]>([]);
  const [lookChecks, setLookChecks] = useState<ChecklistItem[]>([]);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedInspection, setSavedInspection] = useState<Inspection | null>(null);

  function selectVendor(v: CandidateVendor) {
    setVendor(v);
    setStep('sku');
  }

  function selectSku(p: IqcSkuPreset) {
    setPreset(p);
    setMillChecks(buildMillChecks());
    setLookChecks(buildLookChecks(p.type));
    setStep('inspect');
  }

  const verdictResult = useMemo(() => {
    if (!preset) return null;
    return computeVerdict({
      targetThickness: preset.thickness,
      thicknessTol: DEFAULT_TOL,
      thicknessPoints,
      targetWidth: preset.width,
      widthPlus: DEFAULT_WIDTH_PLUS,
      widthMinus: DEFAULT_WIDTH_MINUS,
      widthMeasured: widthMeasured.trim() === '' ? null : parseFloat(widthMeasured),
      millChecks,
      lookChecks,
    });
  }, [preset, thicknessPoints, widthMeasured, millChecks, lookChecks]);

  function updateCheck(list: 'mill' | 'look', idx: number, r: CheckResult) {
    const target = list === 'mill' ? millChecks : lookChecks;
    const setter = list === 'mill' ? setMillChecks : setLookChecks;
    setter(target.map((c, i) => (i === idx ? { ...c, r } : c)));
  }

  async function saveEvaluation() {
    if (!vendor || !preset || !verdictResult) return;
    if (verdictResult.verdict === 'PENDING') {
      toast.error('체크리스트 미완료 — 모든 항목에 응답해 주세요');
      return;
    }
    if (!sampleNumber.trim()) {
      toast.error('샘플 번호를 입력해 주세요');
      return;
    }
    setSaving(true);

    const now = new Date().toISOString();
    // 상용 조건 스냅샷 — 평가 시점 vendor 조건을 그대로 보존
    const snap: CommercialSnapshot = {
      price_note: vendor.price_note ?? undefined,
      moq: vendor.moq ?? undefined,
      lead_time: vendor.lead_time ?? undefined,
      payment_terms: vendor.payment_terms ?? undefined,
    };

    const insp: Inspection = {
      id: crypto.randomUUID(),
      inventory_id: null,
      product_id: 'dev-' + preset.code,
      product_name: presetToProductName(preset),
      lot_number: sampleNumber.trim(),
      supplier: vendor.name,
      coil_count: null,
      inspector: inspector.trim() || null,
      inspected_at: new Date().toISOString().slice(0, 10),
      thickness_points: thicknessPoints,
      thickness_tol: DEFAULT_TOL,
      width_measured: widthMeasured.trim() === '' ? null : parseFloat(widthMeasured),
      weight_measured: weightMeasured.trim() === '' ? null : parseFloat(weightMeasured),
      mill_checks: millChecks,
      look_checks: lookChecks,
      photo_urls: [],
      memo: memo.trim() || null,
      verdict: verdictResult.verdict === 'PASS' ? 'PASS' : 'FAIL',
      purpose: 'vendor_sample',
      candidate_vendor_id: vendor.id,
      candidate_vendor_name: vendor.name,
      commercial_snapshot: snap,
      created_at: now,
    };

    try {
      if (isDevMode) {
        saveDevInspection(insp);
      } else {
        const res = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: insp.product_id,
            lot_number: insp.lot_number,
            supplier: insp.supplier,
            inspector: insp.inspector,
            inspected_at: insp.inspected_at,
            thickness_points: insp.thickness_points,
            thickness_tol: insp.thickness_tol,
            width_measured: insp.width_measured,
            weight_measured: insp.weight_measured,
            mill_checks: insp.mill_checks,
            look_checks: insp.look_checks,
            memo: insp.memo,
            verdict: insp.verdict,
            purpose: 'vendor_sample',
            candidate_vendor_id: vendor.id,
            commercial_snapshot: snap,
            register_inventory: false,
          }),
        });
        if (!res.ok) {
          const { readApiError } = await import('@/lib/api-error');
          throw new Error(await readApiError(res));
        }
        const data = await res.json();
        insp.id = data.inspection_id;
      }
      setSavedInspection(insp);
      toast.success(
        insp.verdict === 'PASS'
          ? `${vendor.name} 샘플 합격 — 비교표에 반영됩니다`
          : `${vendor.name} 샘플 불합격 저장됨`,
      );
      setStep('saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally { setSaving(false); }
  }

  function resetForNext() {
    setPreset(null);
    setSampleNumber(''); setInspector('');
    setThicknessPoints([null, null, null, null, null]);
    setWidthMeasured(''); setWeightMeasured(''); setMemo('');
    setSavedInspection(null);
    setStep('sku');   // vendor 유지, SKU 부터 다시
  }

  return (
    <div className="space-y-4">
      <Toaster position="top-center" />

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        <span className={step === 'vendor' ? 'text-white font-semibold' : ''}>1. 업체 선택</span>
        <ChevronRight className="w-3 h-3" />
        <span className={step === 'sku' ? 'text-white font-semibold' : ''}>2. SKU</span>
        <ChevronRight className="w-3 h-3" />
        <span className={step === 'inspect' ? 'text-white font-semibold' : ''}>3. 샘플 검수</span>
        <ChevronRight className="w-3 h-3" />
        <span className={step === 'saved' ? 'text-white font-semibold' : ''}>4. 완료</span>
      </div>

      {/* 선택된 업체 미니 요약 (vendor 이후 모든 단계) */}
      {vendor && step !== 'vendor' && (
        <Card className="bg-gradient-to-r from-purple-900/20 to-[#13161f] border-purple-500/30">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-white">
              <Building2 className="w-4 h-4 inline mr-1 text-purple-300" />
              <b>{vendor.name}</b>
              {vendor.location && <span className="text-gray-400 ml-2">({vendor.location})</span>}
            </div>
            <button
              onClick={() => { setVendor(null); setPreset(null); setStep('vendor'); }}
              className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> 업체 변경
            </button>
          </CardContent>
        </Card>
      )}

      {step === 'vendor' && (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">평가할 후보 업체 선택 · 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <VendorSelector value={vendor} onSelect={selectVendor} />
          </CardContent>
        </Card>
      )}

      {step === 'sku' && (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">샘플 SKU 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <SkuSelector value={preset} onSelect={selectSku} />
          </CardContent>
        </Card>
      )}

      {step === 'inspect' && preset && verdictResult && (
        <>
          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-white">
                    {presetToProductName(preset)}
                  </CardTitle>
                  <div className="text-xs text-gray-400 mt-0.5">
                    기준 두께 {preset.thickness.toFixed(3)}mm · 폭 {preset.width}mm · {preset.purity}
                  </div>
                </div>
                <button
                  onClick={() => { setPreset(null); setStep('sku'); }}
                  className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> SKU 변경
                </button>
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">샘플 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-400">샘플 번호 *</Label>
                <Input value={sampleNumber} onChange={(e) => setSampleNumber(e.target.value)}
                  placeholder="예: SAMPLE-A-01"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-400">검수자</Label>
                <Input value={inspector} onChange={(e) => setInspector(e.target.value)}
                  placeholder="이름"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">두께 측정 (5점)</CardTitle>
            </CardHeader>
            <CardContent>
              <ThicknessGauge
                target={preset.thickness}
                tolerance={DEFAULT_TOL}
                values={thicknessPoints}
                onChange={setThicknessPoints}
              />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">폭 · 중량 (선택)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-400">
                  실측 폭 (기준 {preset.width}, 허용 +{DEFAULT_WIDTH_PLUS}/-{DEFAULT_WIDTH_MINUS})
                </Label>
                <Input type="number" inputMode="decimal" step="0.1" value={widthMeasured}
                  onChange={(e) => setWidthMeasured(e.target.value)}
                  placeholder={`${preset.width}`}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-400">실측 중량 (kg, 선택)</Label>
                <Input type="number" inputMode="decimal" value={weightMeasured}
                  onChange={(e) => setWeightMeasured(e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">📄 성적서(Mill) 대조</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {millChecks.map((c, i) => (
                <TriCheck key={i} item={c} onChange={(r) => updateCheck('mill', i, r)} />
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">👁️ 외관(Look) 검수</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lookChecks.map((c, i) => (
                <TriCheck key={i} item={c} onChange={(r) => updateCheck('look', i, r)} />
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardContent className="pt-4">
              <Label className="text-xs text-gray-400">특이사항</Label>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
                rows={2} placeholder="공장 규모·인상·기타 관찰 사항"
                className="mt-1 w-full px-3 py-2 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm resize-none" />
            </CardContent>
          </Card>

          <VerdictSummary verdict={verdictResult.verdict} reasons={verdictResult.reasons} />

          <div className="h-24" />

          {/* 하단 sticky 저장 바 */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b0d13]/95 backdrop-blur-xl border-t border-white/[0.06]">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">종합 판정</div>
                <div className={`text-xl font-extrabold ${
                  verdictResult.verdict === 'PASS' ? 'text-green-400'
                  : verdictResult.verdict === 'FAIL' ? 'text-red-400'
                  : 'text-amber-400'
                }`}>
                  {verdictResult.verdict === 'PASS' && '✓ 합격'}
                  {verdictResult.verdict === 'FAIL' && '✕ 불합격'}
                  {verdictResult.verdict === 'PENDING' && '⏸ 진행 중'}
                </div>
              </div>
              <Button
                onClick={saveEvaluation}
                disabled={saving || verdictResult.verdict === 'PENDING'}
                className={`h-12 px-6 text-sm font-semibold ${
                  verdictResult.verdict === 'PASS'
                    ? 'bg-green-600 hover:bg-green-700'
                    : verdictResult.verdict === 'FAIL'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-600'
                } text-white`}
              >
                <ClipboardCheck className="w-4 h-4 mr-1" />
                {saving ? '저장 중...' : verdictResult.verdict === 'PENDING'
                  ? '항목 완료 필요'
                  : `${VERDICT_BADGE[verdictResult.verdict].label}로 저장`}
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 'saved' && savedInspection && vendor && preset && (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              {savedInspection.verdict === 'PASS' ? (
                <><CheckCircle2 className="w-5 h-5 text-green-400" /> 샘플 평가 저장 (합격)</>
              ) : (
                <><AlertTriangle className="w-5 h-5 text-red-400" /> 샘플 평가 저장 (불합격)</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-300 space-y-1">
              <div>업체: <b className="text-white">{vendor.name}</b></div>
              <div>SKU: <b className="text-white">{presetToProductName(preset)}</b></div>
              <div>샘플: <b className="text-white">{savedInspection.lot_number}</b></div>
              {savedInspection.commercial_snapshot && (
                <div className="text-xs text-gray-500 mt-2 space-x-3">
                  {savedInspection.commercial_snapshot.price_note && (
                    <span>💰 {savedInspection.commercial_snapshot.price_note}</span>
                  )}
                  {savedInspection.commercial_snapshot.moq && (
                    <span>MOQ {savedInspection.commercial_snapshot.moq}</span>
                  )}
                  {savedInspection.commercial_snapshot.lead_time && (
                    <span>납기 {savedInspection.commercial_snapshot.lead_time}</span>
                  )}
                  {savedInspection.commercial_snapshot.payment_terms && (
                    <span>결제 {savedInspection.commercial_snapshot.payment_terms}</span>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#1f2433] grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                onClick={() => router.push('/admin/vendors/compare')}
                className="bg-[#1a3d6b] hover:bg-[#235490] text-white"
              >
                <BarChart3 className="w-4 h-4 mr-1" /> 비교표로 이동
              </Button>
              <Button
                onClick={resetForNext}
                variant="outline"
              >
                다음 샘플 평가 (같은 업체)
              </Button>
              <Button
                onClick={() => { setVendor(null); setPreset(null); setStep('vendor'); setSavedInspection(null); }}
                variant="outline"
              >
                다른 업체 평가
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VerdictSummary({ verdict, reasons }: { verdict: Verdict; reasons: string[] }) {
  const badge = VERDICT_BADGE[verdict];
  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-sm font-bold border ${badge.color}`}>
            {badge.label}
          </div>
          <div className="text-sm text-gray-300">
            {verdict === 'PASS' && '기준 만족 — 비교표에 표시'}
            {verdict === 'FAIL' && '기준 미달 — 원인 아래 확인'}
            {verdict === 'PENDING' && '체크리스트 미완료 항목 있음'}
          </div>
        </div>
        {reasons.length > 0 && (
          <ul className="mt-2 text-xs text-red-300 space-y-0.5 pl-2">
            {reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
