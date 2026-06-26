import Link from 'next/link';
import { CustomerOrderList } from '@/components/customer/OrderList';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function CustomerOrdersPage() {
  return (
    <div className="min-h-screen bg-app-light p-4 sm:p-6 text-[#1c1c1c]">
      <header className="mb-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm text-[#1a3d6b] font-semibold">OMWIS · 거래처</div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">주문 내역</h1>
            <p className="text-sm text-gray-600 mt-1">
              상태별로 필터링하거나 과거 주문을 클릭 한 번으로 재주문하세요
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href="/customer/documents"
              className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg bg-white border border-[#1a3d6b]/20 text-[#1a3d6b] hover:bg-[#1a3d6b] hover:text-white transition text-sm whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              세금계산서
            </Link>
            <Link href="/customer/order">
              <Button className="bg-[#1a3d6b] hover:bg-[#235490] text-white h-10">
                + 새 주문
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <CustomerOrderList />
    </div>
  );
}
