import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { VendorSampleWizard } from '@/components/vendors/VendorSampleWizard';

export const dynamic = 'force-dynamic';

export default function VendorEvaluatePage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <Link
          href="/admin/vendors"
          className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2"
        >
          <ChevronLeft className="w-3 h-3" /> 업체 목록
        </Link>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-purple-400/80 mb-1">
          샘플 평가 위저드
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          후보 업체 샘플 IQC
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          업체 선택 → SKU 선택 → 검수 입력 → 저장. 재고 등록 없이 상용 조건 스냅샷과 함께 평가 이력만 기록됩니다.
        </p>
      </header>

      <div className="max-w-4xl">
        <VendorSampleWizard />
      </div>
    </div>
  );
}
