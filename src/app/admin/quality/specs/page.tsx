import { SpecsManager } from '@/components/quality/SpecsManager';

export const dynamic = 'force-dynamic';

export default function InspectionSpecsPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
          검수 기준 관리
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          품목별 검수 공차·허용치
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          공급사·계약별로 다른 검수 기준을 품목별로 설정합니다. 미설정 시 기본값으로 판정.
        </p>
      </header>

      <SpecsManager />
    </div>
  );
}
