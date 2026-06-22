import { AdminOrderList } from '@/components/admin/AdminOrderList';

export default function AdminOrdersPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">주문 관리</h1>
        <p className="text-sm text-gray-400 mt-1">
          신규 주문 승인·거절, 납기 조정, 상태 진행 (접수 → 처리중 → 출고준비 → 배송중 → 완료)
        </p>
      </header>

      <AdminOrderList />
    </div>
  );
}
