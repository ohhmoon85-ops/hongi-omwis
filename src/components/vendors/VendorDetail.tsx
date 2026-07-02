'use client';

// ============================================================================
// VendorDetail — 후보 업체 상세 + 평가 이력 + 승격/탈락/보류
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDevVendor, updateDevVendorStatus } from '@/lib/dev-vendors';
import { loadDevInspectionsByVendor } from '@/lib/dev-inspections';
import { fetchCandidateVendor, promoteVendor, rejectVendor } from '@/lib/vendors';
import { fetchInspectionsByVendor } from '@/lib/inspections';
import { isDevMode } from '@/lib/dev-data';
import { formatDate } from '@/lib/utils';
import type { CandidateVendor, Inspection } from '@/types';
import { VENDOR_STATUS_BADGE, VERDICT_BADGE } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import toast, { Toaster } from 'react-hot-toast';
import {
  ChevronLeft, CheckCircle2, XCircle, PauseCircle,
  Plus, Building2, MessageCircle,
} from 'lucide-react';

interface Props { id: string }

export function VendorDetail({ id }: Props) {
  const router = useRouter();
  const [vendor, setVendor] = useState<CandidateVendor | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      if (isDevMode) {
        setVendor(getDevVendor(id));
        setInspections(loadDevInspectionsByVendor(id));
      } else {
        const [v, insps] = await Promise.all([
          fetchCandidateVendor(id),
          fetchInspectionsByVendor(id).catch(() => []),
        ]);
        setVendor(v);
        setInspections(insps);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '조회 실패');
    } finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); }, [id]);

  async function handlePromote() {
    if (!vendor) return;
    const memo = window.prompt('승격 사유 / 특이사항 (선택)') ?? undefined;
    if (memo === null) return;
    const ok = window.confirm(
      `${vendor.name} 을(를) 정식 공급사로 승격합니다.\n이후 재고 검수 화면의 공급사 선택 목록에 노출됩니다.`,
    );
    if (!ok) return;
    try {
      if (isDevMode) updateDevVendorStatus(vendor.id, 'approved', memo);
      else await promoteVendor(vendor.id, memo);
      toast.success('승격 완료 — 정식 공급사 등록됨');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승격 실패');
    }
  }

  async function handleReject() {
    if (!vendor) return;
    const memo = window.prompt('탈락 사유 (사후 기록용, 데이터는 보존됨)');
    if (memo === null) return;
    try {
      if (isDevMode) updateDevVendorStatus(vendor.id, 'rejected', memo || undefined);
      else await rejectVendor(vendor.id, memo || undefined);
      toast(`${vendor.name} 탈락 처리`, { icon: '⚠️' });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리 실패');
    }
  }

  async function handleHold() {
    if (!vendor) return;
    const memo = window.prompt('보류 사유 (계속 평가할 예정이면 이 옵션)');
    if (memo === null) return;
    try {
      if (isDevMode) updateDevVendorStatus(vendor.id, 'on_hold', memo || undefined);
      else {
        const res = await fetch('/api/vendors/promote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: vendor.id, action: 'hold', memo }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      toast('보류로 변경', { icon: '⏸' });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리 실패');
    }
  }

  if (!loaded) return <div className="text-sm text-gray-500">불러오는 중...</div>;
  if (!vendor) return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
      <CardContent className="py-12 text-center text-sm text-gray-500">
        업체를 찾을 수 없습니다.
      </CardContent>
    </Card>
  );

  const badge = VENDOR_STATUS_BADGE[vendor.status];
  const passCount = inspections.filter((i) => i.verdict === 'PASS').length;
  const failCount = inspections.filter((i) => i.verdict === 'FAIL').length;

  return (
    <div className="space-y-4 max-w-4xl">
      <Toaster position="top-center" />

      <Link href="/admin/vendors" className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1">
        <ChevronLeft className="w-3 h-3" /> 업체 목록
      </Link>

      {/* 기본 정보 */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <Building2 className="w-5 h-5 text-purple-300" />
            <CardTitle className="text-lg">{vendor.name}</CardTitle>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          {vendor.location && (
            <p className="text-sm text-gray-400 mt-1">📍 {vendor.location}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Info label="담당자"   value={vendor.contact_name ?? '-'} />
            <Info label="WeChat"   value={vendor.wechat ?? '-'} mono />
            <Info label="전화"     value={vendor.phone ?? '-'} />
            <Info label="이메일"   value={vendor.email ?? '-'} />
            <Info label="단가"     value={vendor.price_note ?? '-'} />
            <Info label="MOQ"      value={vendor.moq ?? '-'} />
            <Info label="납기"     value={vendor.lead_time ?? '-'} />
            <Info label="결제"     value={vendor.payment_terms ?? '-'} />
          </div>

          {vendor.factory_note && (
            <div className="pt-3 border-t border-[#1f2433]">
              <div className="text-xs text-gray-400 font-semibold mb-1">공장 정보</div>
              <div className="text-sm text-gray-200 whitespace-pre-wrap">{vendor.factory_note}</div>
            </div>
          )}

          {vendor.memo && (
            <div className="pt-3 border-t border-[#1f2433]">
              <div className="text-xs text-gray-400 font-semibold mb-1">처리 메모</div>
              <div className="text-sm text-gray-200">{vendor.memo}</div>
            </div>
          )}

          {vendor.status === 'approved' && vendor.approved_at && (
            <div className="pt-3 border-t border-[#1f2433] text-sm text-green-300">
              ✅ 정식 공급사 승격 · {formatDate(vendor.approved_at)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => router.push(`/admin/vendors/evaluate`)}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> 새 샘플 평가
        </Button>
        {vendor.status !== 'approved' && (
          <Button onClick={handlePromote} className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="w-4 h-4 mr-1" /> 정식 공급사로 승격
          </Button>
        )}
        {vendor.status !== 'on_hold' && (
          <Button onClick={handleHold} variant="outline" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
            <PauseCircle className="w-4 h-4 mr-1" /> 보류
          </Button>
        )}
        {vendor.status !== 'rejected' && (
          <Button onClick={handleReject} variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10">
            <XCircle className="w-4 h-4 mr-1" /> 탈락
          </Button>
        )}
      </div>

      {/* 평가 이력 */}
      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-200">
            평가 이력 ({inspections.length}건 · 합격 {passCount} · 불합격 {failCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inspections.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">
              평가 이력이 없습니다. 위의 [새 샘플 평가] 로 시작하세요.
            </div>
          ) : (
            <ul className="space-y-2">
              {inspections.map((i) => {
                const b = VERDICT_BADGE[i.verdict];
                return (
                  <li key={i.id}>
                    <Link
                      href={`/admin/quality/${i.id}`}
                      className="block p-3 rounded-lg border border-[#1f2433] hover:border-[#c8962e]/40 transition"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${b.color}`}>
                          {b.label}
                        </span>
                        <span className="font-mono text-sm">{i.lot_number}</span>
                        <span className="text-sm text-gray-300 truncate">{i.product_name}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {formatDate(i.inspected_at)}
                          {i.inspector && ` · ${i.inspector}`}
                        </span>
                      </div>
                      {i.commercial_snapshot && (
                        <div className="text-[10px] text-gray-500 mt-1 space-x-2">
                          {i.commercial_snapshot.price_note && <span>💰 {i.commercial_snapshot.price_note}</span>}
                          {i.commercial_snapshot.moq && <span>MOQ {i.commercial_snapshot.moq}</span>}
                          {i.commercial_snapshot.lead_time && <span>납기 {i.commercial_snapshot.lead_time}</span>}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {vendor.wechat && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" />
          현지 소통은 WeChat: <span className="font-mono text-gray-300">{vendor.wechat}</span>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`mt-0.5 text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
