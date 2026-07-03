import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CardCollection } from '@/components/cards/CardCollection';

export const dynamic = 'force-dynamic';

export default function CardsPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <Link href="/admin/vendors" className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="w-3 h-3" /> 업체 발굴
        </Link>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-purple-400/80 mb-1">
          명함 수집함
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          명함 정리
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          현장에서 촬영해 온 명함을 하나씩 업체로 등록합니다. AI 읽기는 키가 있으면 자동으로 나타납니다.
        </p>
      </header>

      <CardCollection />
    </div>
  );
}
