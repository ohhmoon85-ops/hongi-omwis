import { DeliveryList } from '@/components/driver/DeliveryList';

export default function DeliveriesPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">배송 관리</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
        <p className="text-sm text-gray-400 mt-1">
          배차된 주문의 출발·배송 완료를 처리합니다 (완료 시 주문도 자동 완료)
        </p>
      </header>

      <DeliveryList />
    </div>
  );
}
