'use client';

// ============================================================================
// InspectionDetail — 검수 상세 (dev + real 모드) + 인쇄
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDevInspection } from '@/lib/dev-inspections';
import { fetchInspection, fetchInspectionReturns } from '@/lib/inspections';
import { getInspectionPhotoUrls } from '@/lib/storage';
import { isDevMode } from '@/lib/dev-data';
import { formatDate, formatNumber } from '@/lib/utils';
import { thicknessStats } from '@/lib/iqc-verdict';
import type { Inspection, ChecklistItem } from '@/types';
import { VERDICT_BADGE } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Printer, Check, X, Minus, Undo2 } from 'lucide-react';

interface Props { id: string }

export function InspectionDetail({ id }: Props) {
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [linkedReturns, setLinkedReturns] = useState<Array<{
    id: string; order_number: string; reason: string;
    restock: boolean; return_date: string; customer_name: string | null;
  }>>([]);
  const [photoUrls, setPhotoUrls] = useState<Array<{ path: string; url: string | null }>>([]);

  useEffect(() => {
    (async () => {
      try {
        if (isDevMode) {
          setInsp(getDevInspection(id));
        } else {
          const [i, rets] = await Promise.all([
            fetchInspection(id),
            fetchInspectionReturns(id).catch(() => []),
          ]);
          setInsp(i);
          setLinkedReturns(rets);
          if (i && i.photo_urls.length > 0) {
            const urls = await getInspectionPhotoUrls(i.photo_urls);
            setPhotoUrls(urls);
          }
        }
      } finally { setLoaded(true); }
    })();
  }, [id]);

  if (!loaded) return <div className="text-sm text-gray-500">불러오는 중...</div>;
  if (!insp) return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
      <CardContent className="py-12 text-center text-sm text-gray-500">
        검수 기록을 찾을 수 없습니다.
      </CardContent>
    </Card>
  );

  const badge = VERDICT_BADGE[insp.verdict];
  const stats = insp.thickness_points ? thicknessStats(insp.thickness_points) : null;
  const min = stats ? stats.min : null;
  const max = stats ? stats.max : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between no-print">
        <Link href="/admin/quality" className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> 검수 목록
        </Link>
        <Button onClick={() => window.print()} className="bg-[#1a3d6b] hover:bg-[#235490] text-white">
          <Printer className="w-4 h-4 mr-1" /> 성적서 인쇄
        </Button>
      </div>

      <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-sm font-bold border ${badge.color}`}>
              {badge.label}
            </div>
            <CardTitle className="text-lg">{insp.product_name ?? insp.product_id}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Info label="로트 번호" value={insp.lot_number} mono />
            <Info label="공급사" value={insp.supplier ?? '-'} />
            <Info label="코일 수" value={insp.coil_count != null ? `${insp.coil_count}개` : '-'} />
            <Info label="검수일" value={formatDate(insp.inspected_at)} />
            {insp.inspector && <Info label="검수자" value={insp.inspector} />}
            {insp.weight_measured != null && (
              <Info label="실측 중량" value={`${formatNumber(insp.weight_measured)}kg`} />
            )}
            {insp.width_measured != null && (
              <Info label="실측 폭" value={`${insp.width_measured}mm`} />
            )}
          </div>

          {/* 두께 5점 */}
          {insp.thickness_points && stats && (
            <div className="pt-3 border-t border-[#1f2433]">
              <div className="text-xs text-gray-400 font-semibold mb-2">두께 측정 (5점)</div>
              <div className="grid grid-cols-5 gap-2">
                {['좌상', '좌중', '중앙', '우중', '우하'].map((lbl, i) => {
                  const p = insp.thickness_points![i];
                  const outOfRange = p != null && (p < (stats.avg - insp.thickness_tol * 2) || p > (stats.avg + insp.thickness_tol * 2));
                  return (
                    <div key={i} className="text-center">
                      <div className="text-[10px] text-gray-500 mb-0.5">{lbl}</div>
                      <div className={`px-2 py-1 rounded border text-sm font-mono ${
                        outOfRange
                          ? 'bg-red-500/15 border-red-500/40 text-red-300'
                          : 'bg-[#0f1117] border-[#2a2f3e] text-gray-200'
                      }`}>
                        {p != null ? p.toFixed(3) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-gray-400 flex gap-4">
                <span>평균 {stats.avg.toFixed(3)}mm</span>
                <span>최소 {min?.toFixed(3)}</span>
                <span>최대 {max?.toFixed(3)}</span>
                <span>공차 ±{insp.thickness_tol}</span>
              </div>
            </div>
          )}

          {/* 체크리스트 */}
          <div className="pt-3 border-t border-[#1f2433]">
            <div className="text-xs text-gray-400 font-semibold mb-2">📄 성적서(Mill) 대조</div>
            <ChecklistView items={insp.mill_checks} />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold mb-2">👁️ 외관(Look) 검수</div>
            <ChecklistView items={insp.look_checks} />
          </div>

          {/* 사진 갤러리 */}
          {photoUrls.length > 0 && (
            <div className="pt-3 border-t border-[#1f2433]">
              <div className="text-xs text-gray-400 font-semibold mb-2">📸 검수 사진 ({photoUrls.length})</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {photoUrls.map((p) => (
                  <a
                    key={p.path}
                    href={p.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-md overflow-hidden bg-[#0f1117] border border-[#2a2f3e] hover:border-[#c8962e]/40 transition"
                    title="새 탭에서 원본 보기"
                  >
                    {p.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.url} alt="검수 사진" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        (로드 실패)
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {insp.memo && (
            <div className="pt-3 border-t border-[#1f2433]">
              <div className="text-xs text-gray-400 font-semibold mb-1">특이사항</div>
              <div className="text-sm text-gray-200">{insp.memo}</div>
            </div>
          )}

          {insp.inventory_id && (
            <div className="pt-3 border-t border-[#1f2433] text-sm text-green-300">
              ✅ 이 검수로 재고 lot 등록됨 (inventory_id: <span className="font-mono">{insp.inventory_id.slice(0, 8)}</span>)
            </div>
          )}

          {linkedReturns.length > 0 && (
            <div className="pt-3 border-t border-[#1f2433]">
              <div className="text-xs text-orange-300 font-semibold mb-2 flex items-center gap-1">
                <Undo2 className="w-3 h-3" />
                이 로트로부터 발생한 반품 {linkedReturns.length}건
              </div>
              <ul className="space-y-1.5">
                {linkedReturns.map((r) => (
                  <li key={r.id} className="text-sm bg-orange-500/10 border border-orange-500/30 rounded p-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-xs text-orange-200">{r.order_number}</span>
                      <span className="text-[11px] text-gray-400">
                        {formatDate(r.return_date)}
                        {r.customer_name && ` · ${r.customer_name}`}
                        {r.restock ? ' · 재고 복원' : ' · 폐기'}
                      </span>
                    </div>
                    <div className="text-[13px] text-gray-200 mt-0.5">{r.reason}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
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

function ChecklistView({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((c, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {c.r === 'ok'  && <Check className="w-4 h-4 mt-0.5 text-green-400 flex-shrink-0" />}
          {c.r === 'ng'  && <X     className="w-4 h-4 mt-0.5 text-red-400   flex-shrink-0" />}
          {c.r === null  && <Minus className="w-4 h-4 mt-0.5 text-gray-500  flex-shrink-0" />}
          <span className={c.r === 'ng' ? 'text-red-300' : 'text-gray-200'}>{c.q}</span>
        </li>
      ))}
    </ul>
  );
}
