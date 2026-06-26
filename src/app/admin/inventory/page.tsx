import Link from 'next/link';
import { InventoryManager } from '@/components/admin/InventoryManager';
import { ClipboardCheck } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">재고 관리</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
          <p className="text-sm text-gray-400 mt-1">
            입고 등록 · Lot 관리 · 재고 조정 · 안전재고 설정 (미달 시 대시보드 경보)
          </p>
        </div>
        <Link
          href="/admin/inventory/stocktake"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a3d6b] hover:bg-[#235490] text-white text-sm transition"
        >
          <ClipboardCheck className="w-4 h-4" />
          재고 실사
        </Link>
      </header>

      <InventoryManager />
    </div>
  );
}
