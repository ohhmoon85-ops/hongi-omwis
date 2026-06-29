import { ProductManager } from '@/components/admin/ProductManager';

export default function ProductsPage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">품목 단가</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
        <p className="text-sm text-gray-400 mt-1">
          품목 기본 단가 수정 · 추가 · 판매 중지 (거래처별 협상가는 거래처 상세에서 설정)
        </p>
      </header>

      <ProductManager />
    </div>
  );
}
