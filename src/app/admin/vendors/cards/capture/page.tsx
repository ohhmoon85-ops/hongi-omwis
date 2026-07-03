import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CardCapture } from '@/components/cards/CardCapture';

export const dynamic = 'force-dynamic';

export default function CardCapturePage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5 max-w-md mx-auto">
        <Link href="/admin/vendors/cards" className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="w-3 h-3" /> 명함 수집함
        </Link>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-purple-400/80 mb-1">
          현장 촬영
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gold-gradient">
          명함 촬영
        </h1>
      </header>

      <CardCapture />
    </div>
  );
}
