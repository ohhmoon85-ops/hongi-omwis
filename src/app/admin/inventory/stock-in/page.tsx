import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { InspectionWizard } from '@/components/quality/InspectionWizard';

export const dynamic = 'force-dynamic';

export default function StockInPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <Link
          href="/admin/inventory"
          className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2"
        >
          <ChevronLeft className="w-3 h-3" /> 재고 관리
        </Link>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
          입고 품질검수 (IQC)
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          검수 → 등록
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          공급사 자재를 12종 프리셋에서 골라 성적서·외관을 검수하고,
          합격 시 재고 lot 으로 등록합니다.
        </p>
      </header>

      <div className="max-w-4xl">
        <InspectionWizard />
      </div>
    </div>
  );
}
