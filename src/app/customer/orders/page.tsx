import Link from 'next/link';
import { CustomerOrderList } from '@/components/customer/OrderList';
import { Button } from '@/components/ui/button';

export default function CustomerOrdersPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] p-4 sm:p-6 text-[#1c1c1c]">
      <header className="mb-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[#1a3d6b] font-semibold">OMWIS · 거래처</div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">주문 내역</h1>
            <p className="text-sm text-gray-600 mt-1">
              상태별로 필터링하거나 과거 주문을 클릭 한 번으로 재주문하세요
            </p>
          </div>
          <Link href="/customer/order">
            <Button className="bg-[#1a3d6b] hover:bg-[#235490] text-white">
              + 새 주문
            </Button>
          </Link>
        </div>
      </header>

      <CustomerOrderList />
    </div>
  );
}
