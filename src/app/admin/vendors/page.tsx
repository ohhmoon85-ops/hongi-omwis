import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { VendorList } from '@/components/vendors/VendorList';

export const dynamic = 'force-dynamic';

export default function VendorsListPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-widest uppercase text-purple-400/80 mb-1">
            업체 발굴 평가
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
            후보 공급업체
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            중국 현지 알루미늄 공급사 발굴 → 샘플 IQC 평가 → 비교 → 승격.
            기존 IQC 기준(12 SKU · 5점 두께 · 성적서·외관)을 그대로 재사용합니다.
          </p>
        </div>
        <Link
          href="/admin/vendors/cards"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 border border-white/[0.06]"
        >
          <CreditCard className="w-4 h-4" /> 명함 수집함
        </Link>
      </header>

      <VendorList />
    </div>
  );
}
