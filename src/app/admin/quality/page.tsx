import Link from 'next/link';
import { QualityList } from '@/components/quality/QualityList';
import { ClipboardCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function QualityListPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
            품질 검수 (IQC)
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
            (주)홍지
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            입고 시 진행한 검수 이력 · 공급사·SKU별 품질 추적
          </p>
        </div>
        <Link
          href="/admin/inventory/stock-in"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm transition"
        >
          <ClipboardCheck className="w-4 h-4" />
          신규 검수 시작
        </Link>
      </header>

      <QualityList />
    </div>
  );
}
