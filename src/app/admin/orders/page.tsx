import { AdminOrderList } from '@/components/admin/AdminOrderList';

export default function AdminOrdersPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">주문 관리</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
        <p className="text-sm text-gray-400 mt-1">
          신규 주문 승인·거절, 납기 조정, 상태 진행 (접수 → 처리중 → 출고준비 → 배송중 → 완료)
        </p>
      </header>

      <AdminOrderList />
    </div>
  );
}
