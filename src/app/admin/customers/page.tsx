import { CustomerList } from '@/components/admin/CustomerList';

export default function AdminCustomersPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">거래처 관리</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
        <p className="text-sm text-gray-400 mt-1">
          본사 직거래(D2C) 거래처 등록·수정·계정 발급 — 대리점에서 이관된 거래처도 함께 관리
        </p>
      </header>

      <CustomerList />
    </div>
  );
}
