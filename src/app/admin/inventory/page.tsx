import { InventoryManager } from '@/components/admin/InventoryManager';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">재고 관리</h1>
        <p className="text-sm text-gray-400 mt-1">
          입고 등록 · Lot 관리 · 재고 조정 · 안전재고 설정 (미달 시 대시보드 경보)
        </p>
      </header>

      <InventoryManager />
    </div>
  );
}
