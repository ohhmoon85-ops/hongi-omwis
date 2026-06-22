import { CustomerList } from '@/components/admin/CustomerList';

export default function AdminCustomersPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">거래처 관리</h1>
        <p className="text-sm text-gray-400 mt-1">
          본사 직거래(D2C) 거래처 등록·수정·계정 발급 — 대리점에서 이관된 거래처도 함께 관리
        </p>
      </header>

      <CustomerList />
    </div>
  );
}
