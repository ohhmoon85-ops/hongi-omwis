'use client';

// ============================================================================
// InspectionWizard — 입고 검수 2단계 흐름
// ----------------------------------------------------------------------------
// STEP 1: 검수 — SKU 선택 → 로트·공급사 → 두께 5점 + 폭 → 체크리스트 → 사진 → 판정
// STEP 2: 입고 — 판정 PASS 시에만 [재고 등록] 버튼 활성화
// ============================================================================

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isDevMode } from '@/lib/dev-data';
import {
  saveDevInspection, registerInventoryFromInspection,
} from '@/lib/dev-inspections';
import {
  buildMillChecks, buildLookChecks,
} from '@/lib/iqc-checklists';
import { computeVerdict } from '@/lib/iqc-verdict';
import { presetToProductName } from '@/lib/iqc-presets';
import { fetchInspectionSpec, DEFAULT_SPEC } from '@/lib/inspection-specs';
import { uploadInspectionPhoto } from '@/lib/storage';
import type {
  IqcSkuPreset, ChecklistItem, CheckResult, Inspection, Verdict,
} from '@/types';
import { VERDICT_BADGE } from '@/types';
import { SkuSelector } from './SkuSelector';
import { ThicknessGauge } from './ThicknessGauge';
import { TriCheck } from './TriCheck';
import {
  ClipboardCheck, PackagePlus, AlertTriangle, CheckCircle2,
  ChevronRight, ArrowLeft, Camera, X as XIcon, Upload,
} from 'lucide-react';

type Step = 'sku' | 'inspect' | 'registered';

interface ActiveSpec {
  thickness_tol: number;
  width_plus: number;
  width_minus: number;
  source: 'default' | 'custom';   // UI 배지 표시용
}

export function InspectionWizard() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('sku');
  const [preset, setPreset] = useState<IqcSkuPreset | null>(null);
  const [spec, setSpec] = useState<ActiveSpec>({
    thickness_tol: DEFAULT_SPEC.thickness_tol,
    width_plus:    DEFAULT_SPEC.width_plus,
    width_minus:   DEFAULT_SPEC.width_minus,
    source: 'default',
  });

  // 검수 폼 상태 (Step 2)
  const [lotNumber, setLotNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [coilCount, setCoilCount] = useState('');
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
  const [uploading, setUploading] = useState(false);
  // 사진 슬롯 — { path?: Supabase 저장 경로, preview: object URL, uploading }
  const [photos, setPhotos] = useState<Array<{
    id: string; path: string | null; preview: string; uploading: boolean;
  }>>([]);

  // 재고 등록 (STEP 3)
  const [quantityKg, setQuantityKg] = useState('');
  const [savedInspection, setSavedInspection] = useState<Inspection | null>(null);

  async function selectSku(p: IqcSkuPreset) {
    setPreset(p);
    setMillChecks(buildMillChecks());
    setLookChecks(buildLookChecks(p.type));
    setStep('inspect');

    // 품목별 검수 기준 로드 (있으면 오버라이드, 없으면 기본값 유지)
    // 운영 모드에서만 조회 — dev 모드는 SKU 프리셋 code 라 매칭 불가
    if (!isDevMode) {
      try {
        // NOTE: p.code 는 프리셋 코드 (예: 'raw-010-540') — 실 product_id 아님.
        // seed-real-products.sql 의 name 규칙으로 매칭해야 하나, 편의상 이번
        // 이터레이션에서는 DEFAULT 유지. 후속: SKU→product_id lookup 매핑 추가.
        const s = await fetchInspectionSpec(p.code).catch(() => null);
        if (s) {
          setSpec({
            thickness_tol: s.thickness_tol,
            width_plus:    s.width_plus,
            width_minus:   s.width_minus,
            source: 'custom',
          });
          return;
        }
      } catch { /* silent — 기본값 유지 */ }
    }
    setSpec({
      thickness_tol: DEFAULT_SPEC.thickness_tol,
      width_plus:    DEFAULT_SPEC.width_plus,
      width_minus:   DEFAULT_SPEC.width_minus,
      source: 'default',
    });
  }

  const verdictResult = useMemo(() => {
    if (!preset) return null;
    return computeVerdict({
      targetThickness: preset.thickness,
      thicknessTol: spec.thickness_tol,
      thicknessPoints,
      targetWidth: preset.width,
      widthPlus: spec.width_plus,
      widthMinus: spec.width_minus,
      widthMeasured: widthMeasured.trim() === '' ? null : parseFloat(widthMeasured),
      millChecks,
      lookChecks,
    });
  }, [preset, spec, thicknessPoints, widthMeasured, millChecks, lookChecks]);

  function updateCheck(list: 'mill' | 'look', idx: number, r: CheckResult) {
    const target = list === 'mill' ? millChecks : lookChecks;
    const setter = list === 'mill' ? setMillChecks : setLookChecks;
    setter(target.map((c, i) => (i === idx ? { ...c, r } : c)));
  }

  // 사진 첨부 — 파일 선택 즉시 preview 표시 + 백그라운드 업로드
  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    // preview 즉시 표시
    const newSlots = list.map((f) => ({
      id: crypto.randomUUID(),
      path: null as string | null,
      preview: URL.createObjectURL(f),
      uploading: !isDevMode,
    }));
    setPhotos((prev) => [...prev, ...newSlots]);

    // dev 모드에서는 업로드 안 함 (preview 만 유지)
    if (isDevMode) return;

    setUploading(true);
    // 병렬 업로드
    await Promise.all(list.map(async (file, i) => {
      const slotId = newSlots[i].id;
      try {
        const { path } = await uploadInspectionPhoto(file);
        setPhotos((prev) => prev.map((p) =>
          p.id === slotId ? { ...p, path, uploading: false } : p,
        ));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${file.name} 업로드 실패`);
        setPhotos((prev) => prev.filter((p) => p.id !== slotId));
      }
    }));
    setUploading(false);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function saveInspection() {
    if (!preset || !verdictResult) return;
    if (verdictResult.verdict === 'PENDING') {
      toast.error('체크리스트 미완료 — 모든 항목에 응답해 주세요');
      return;
    }
    if (!lotNumber.trim()) {
      toast.error('로트 번호를 입력해 주세요');
      return;
    }
    setSaving(true);

    // 아직 업로드 중인 사진이 있으면 대기
    if (photos.some((p) => p.uploading)) {
      toast.error('사진 업로드 완료 후 저장해 주세요');
      return;
    }
    const photoPaths = photos.map((p) => p.path).filter((p): p is string => !!p);

    const now = new Date().toISOString();
    const insp: Inspection = {
      id: crypto.randomUUID(),
      inventory_id: null,
      product_id: 'dev-' + preset.code,      // dev 모드에서는 코드로 대체
      product_name: presetToProductName(preset),
      lot_number: lotNumber.trim(),
      supplier: supplier.trim() || null,
      coil_count: coilCount ? parseInt(coilCount, 10) : null,
      inspector: inspector.trim() || null,
      inspected_at: new Date().toISOString().slice(0, 10),
      thickness_points: thicknessPoints,
      thickness_tol: spec.thickness_tol,
      width_measured: widthMeasured.trim() === '' ? null : parseFloat(widthMeasured),
      weight_measured: weightMeasured.trim() === '' ? null : parseFloat(weightMeasured),
      mill_checks: millChecks,
      look_checks: lookChecks,
      photo_urls: photoPaths,
      memo: memo.trim() || null,
      verdict: verdictResult.verdict === 'PASS' ? 'PASS' : 'FAIL',
      created_at: now,
    };

    try {
      if (isDevMode) {
        saveDevInspection(insp);
      } else {
        // 운영 모드: 서버 API 경유
        const res = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: insp.product_id,
            lot_number: insp.lot_number,
            supplier: insp.supplier,
            coil_count: insp.coil_count,
            inspector: insp.inspector,
            inspected_at: insp.inspected_at,
            thickness_points: insp.thickness_points,
            thickness_tol: insp.thickness_tol,
            width_measured: insp.width_measured,
            weight_measured: insp.weight_measured,
            mill_checks: insp.mill_checks,
            look_checks: insp.look_checks,
            photo_urls: insp.photo_urls,
            memo: insp.memo,
            verdict: insp.verdict,
            register_inventory: false,   // 재고 등록은 별도 버튼
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
          ? '검수 저장 — 재고 등록 가능'
          : '검수 저장 (불합격) — 반송/보류 절차 진행',
      );
      setStep('registered');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function registerInventory() {
    if (!savedInspection || !preset) return;
    const qty = parseFloat(quantityKg);
    if (!qty || qty <= 0) {
      toast.error('수량(kg)을 입력해 주세요');
      return;
    }
    setSaving(true);
    try {
      if (isDevMode) {
        registerInventoryFromInspection(savedInspection, preset, qty);
        toast.success(`재고 등록 완료 — ${qty}kg`);
      } else {
        // 운영 모드: 두 번째 API 호출 — 이미 저장된 검수를 재고로 승격
        // (간단화: register-in 전용 라우트 대신, 다시 POST 하면서 register_inventory=true)
        // 실제로는 별도 PATCH 라우트가 이상적이나 MVP 는 UI 단순화를 위해
        // 동일 저장 재실행이 필요할 시 별도 확장.
        toast.error('운영 모드: 별도 재고 등록 라우트 필요 — 후속 이터레이션');
        return;
      }
      setStep('sku');
      // 화면 리셋
      setPreset(null);
      setLotNumber(''); setSupplier(''); setCoilCount(''); setInspector('');
      setThicknessPoints([null, null, null, null, null]);
      setWidthMeasured(''); setWeightMeasured(''); setMemo(''); setQuantityKg('');
      setSavedInspection(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재고 등록 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Toaster position="top-center" />

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className={step === 'sku' ? 'text-white font-semibold' : ''}>1. SKU 선택</span>
        <ChevronRight className="w-3 h-3" />
        <span className={step === 'inspect' ? 'text-white font-semibold' : ''}>2. 검수 입력</span>
        <ChevronRight className="w-3 h-3" />
        <span className={step === 'registered' ? 'text-white font-semibold' : ''}>3. 재고 등록</span>
      </div>

      {step === 'sku' && (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">검수할 SKU 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <SkuSelector value={preset} onSelect={selectSku} />
          </CardContent>
        </Card>
      )}

      {step === 'inspect' && preset && verdictResult && (
        <>
          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-white">
                  {presetToProductName(preset)}
                </CardTitle>
                <div className="text-xs text-gray-400 mt-0.5">
                  기준 두께 {preset.thickness.toFixed(3)}mm · 폭 {preset.width}mm · {preset.purity}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  검수 기준:
                  <span className={spec.source === 'custom' ? 'text-green-300' : 'text-gray-400'}>
                    {' '}{spec.source === 'custom' ? '개별 설정' : '기본값'}
                  </span>
                  {' · '}공차 ±{spec.thickness_tol}mm · 폭 +{spec.width_plus}/-{spec.width_minus}
                </div>
              </div>
              <button
                onClick={() => { setPreset(null); setStep('sku'); }}
                className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> SKU 다시 선택
              </button>
            </CardHeader>
          </Card>

          {/* 로트·공급사·검수자 */}
          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-gray-400">로트 번호 *</Label>
                <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="예: HZ2607-01"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-400">공급사</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)}
                  placeholder="예: 中國 XX Aluminium"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-400">코일 수</Label>
                <Input type="number" inputMode="numeric" value={coilCount}
                  onChange={(e) => setCoilCount(e.target.value)}
                  placeholder="10"
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

          {/* 두께 5점 */}
          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">두께 측정 (5점)</CardTitle>
            </CardHeader>
            <CardContent>
              <ThicknessGauge
                target={preset.thickness}
                tolerance={spec.thickness_tol}
                values={thicknessPoints}
                onChange={setThicknessPoints}
              />
            </CardContent>
          </Card>

          {/* 폭·중량 */}
          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200">폭 · 중량 (선택)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-400">
                  실측 폭 (기준 {preset.width}, 허용 +{spec.width_plus}/-{spec.width_minus})
                </Label>
                <Input type="number" inputMode="decimal" step="0.1" value={widthMeasured}
                  onChange={(e) => setWidthMeasured(e.target.value)}
                  placeholder={`${preset.width}`}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-400">실측 중량 (kg)</Label>
                <Input type="number" inputMode="decimal" value={weightMeasured}
                  onChange={(e) => setWeightMeasured(e.target.value)}
                  placeholder="예: 1200"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* 성적서 체크 */}
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

          {/* 외관 체크 */}
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

          {/* 사진 첨부 */}
          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-200 flex items-center gap-1.5">
                📸 검수 사진
                {uploading && <span className="text-[10px] text-amber-300 font-normal">업로드 중...</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((ph) => (
                    <div key={ph.id} className="relative aspect-square rounded-md overflow-hidden bg-[#0f1117] border border-[#2a2f3e]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.preview} alt="검수 사진" className="w-full h-full object-cover" />
                      {ph.uploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Upload className="w-5 h-5 text-white animate-pulse" />
                        </div>
                      )}
                      {ph.path && (
                        <div className="absolute bottom-1 left-1 text-[9px] px-1 rounded bg-green-500/80 text-white">
                          ✓
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(ph.id)}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-500/80"
                        aria-label="사진 제거"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer">
                <div className={`border-2 border-dashed rounded-lg h-16 flex items-center justify-center text-sm gap-2 transition ${
                  photos.length > 0
                    ? 'border-[#2a2f3e] text-gray-500 hover:border-[#c8962e]/40'
                    : 'border-[#c8962e]/40 text-[#e0bf70] hover:border-[#c8962e]'
                }`}>
                  <Camera className="w-5 h-5" />
                  {photos.length > 0 ? '사진 추가' : '사진 촬영/선택 (여러 장 가능)'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(e) => addPhotos(e.target.files)}
                  className="sr-only"
                />
              </label>
              <p className="text-[10px] text-gray-500">
                {isDevMode
                  ? '🛠️ 개발 모드: 사진은 미리보기만 됩니다 (Supabase 연결 시 실 업로드).'
                  : '성적서·라벨·외관 결함 등 근거 사진을 첨부하세요. 클레임·회장 조회 시 근거로 사용됩니다.'}
              </p>
            </CardContent>
          </Card>

          {/* 메모 */}
          <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
            <CardContent className="pt-4">
              <Label className="text-xs text-gray-400">특이사항 메모</Label>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
                rows={2} placeholder="추가 관찰 사항, 반송 사유 등"
                className="mt-1 w-full px-3 py-2 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm resize-none" />
            </CardContent>
          </Card>

          {/* 실시간 판정 + 저장 */}
          <VerdictSummary verdict={verdictResult.verdict} reasons={verdictResult.reasons} />
          <div className="flex gap-2">
            <Button
              onClick={saveInspection}
              disabled={saving || verdictResult.verdict === 'PENDING'}
              className={`flex-1 h-12 text-base ${
                verdictResult.verdict === 'PASS'
                  ? 'bg-green-600 hover:bg-green-700'
                  : verdictResult.verdict === 'FAIL'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-600'
              } text-white`}
            >
              <ClipboardCheck className="w-4 h-4 mr-1" />
              {saving ? '저장 중...' : `${VERDICT_BADGE[verdictResult.verdict].label} 로 저장`}
            </Button>
          </div>
        </>
      )}

      {step === 'registered' && savedInspection && preset && (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              {savedInspection.verdict === 'PASS' ? (
                <><CheckCircle2 className="w-5 h-5 text-green-400" /> 합격 — 재고 등록</>
              ) : (
                <><AlertTriangle className="w-5 h-5 text-red-400" /> 불합격 — 반송/보류</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-300 space-y-1">
              <div>SKU: <b className="text-white">{presetToProductName(preset)}</b></div>
              <div>로트: <b className="text-white">{savedInspection.lot_number}</b>
                {savedInspection.supplier && <> · 공급사 {savedInspection.supplier}</>}</div>
              <div className="text-xs text-gray-500">
                검수 ID {savedInspection.id.slice(0, 8)} · {savedInspection.inspected_at}
              </div>
            </div>

            {savedInspection.verdict === 'PASS' ? (
              <div className="space-y-3 pt-3 border-t border-[#1f2433]">
                <Label className="text-xs text-gray-400">입고 수량 (kg)</Label>
                <Input type="number" inputMode="decimal" value={quantityKg}
                  onChange={(e) => setQuantityKg(e.target.value)}
                  placeholder="예: 3000"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white" />
                <div className="flex gap-2">
                  <Button
                    onClick={registerInventory}
                    disabled={saving || !quantityKg}
                    className="flex-1 h-12 bg-[#1a3d6b] hover:bg-[#235490] text-white"
                  >
                    <PackagePlus className="w-4 h-4 mr-1" />
                    {saving ? '등록 중...' : '재고 lot 등록'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-[#1f2433] space-y-2">
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded p-3">
                  이 로트는 <b>재고 등록이 차단됩니다.</b><br />
                  공급사 클레임 사유로 검수 기록·사진이 보존됩니다. 반송/보류 절차를 진행해 주세요.
                </div>
                <Button
                  onClick={() => { setStep('sku'); setPreset(null); setSavedInspection(null); }}
                  variant="outline"
                  className="w-full"
                >
                  다음 검수 진행
                </Button>
              </div>
            )}
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
            {verdict === 'PASS' && '모든 항목 통과 — 저장 후 재고 등록 가능'}
            {verdict === 'FAIL' && '이상 발견 — 저장 시 반송/보류 처리'}
            {verdict === 'PENDING' && '체크리스트 미완료 — 모든 항목에 응답 필요'}
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
