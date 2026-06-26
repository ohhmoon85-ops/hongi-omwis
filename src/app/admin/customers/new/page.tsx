import Link from 'next/link';
import { CustomerForm } from '@/components/admin/CustomerForm';
import { ChevronLeft } from 'lucide-react';

export default function NewCustomerPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6 max-w-3xl">
        <Link
          href="/admin/customers"
          className="text-xs text-gray-400 hover:text-white inline-flex items-center"
        >
          <ChevronLeft className="w-3 h-3" /> 거래처 목록
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">신규 거래처 등록</h1>
        <p className="text-sm text-gray-400 mt-1">
          ※ 등록만 하면 로그인 계정이 자동 생성되지는 않습니다.
          이메일을 채워두면 Supabase 연결 후 슈퍼관리자가 계정 발급할 수 있습니다.
        </p>
      </header>

      <CustomerForm mode="create" />
    </div>
  );
}
