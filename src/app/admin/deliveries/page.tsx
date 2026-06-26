import { DeliveryList } from '@/components/driver/DeliveryList';

export default function DeliveriesPage() {
  return (
    <div className="min-h-screen bg-app p-4 sm:p-6 text-white">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">배송 관리</h1>
        <p className="text-sm text-gray-400 mt-1">
          배차된 주문의 출발·배송 완료를 처리합니다 (완료 시 주문도 자동 완료)
        </p>
      </header>

      <DeliveryList />
    </div>
  );
}
