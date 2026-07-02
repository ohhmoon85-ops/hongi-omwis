import { VendorComparisonTable } from '@/components/vendors/VendorComparisonTable';

export const dynamic = 'force-dynamic';

export default function VendorComparePage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 no-print">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-purple-400/80 mb-1">
          업체 비교
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          후보 업체 평가 비교표
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          모든 후보 업체의 샘플 평가 결과와 상용 조건을 한 표에서 비교. 인쇄 시 A4 가로.
        </p>
      </header>

      <VendorComparisonTable />
    </div>
  );
}
