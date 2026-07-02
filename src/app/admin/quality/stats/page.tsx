import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { QualityStats } from '@/components/quality/QualityStats';

export const dynamic = 'force-dynamic';

export default function QualityStatsPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <Link href="/admin/quality" className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="w-3 h-3" /> 검수 이력
        </Link>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
          품질 통계
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          공급사·SKU 품질 분석
        </h1>
      </header>

      <QualityStats />
    </div>
  );
}
