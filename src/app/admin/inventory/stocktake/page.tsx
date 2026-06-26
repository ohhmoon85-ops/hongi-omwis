import { StocktakeManager } from '@/components/admin/StocktakeManager';

export default function StocktakePage() {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">재고 실사</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
        <p className="text-sm text-gray-400 mt-1">
          월별 실사 — Lot 별 실측 수량 입력 시 장부재고와의 차이가 자동 계산되며,
          일괄 적용으로 모든 차이가 한 번에 inventory_logs(adjust) 로 기록됩니다.
        </p>
      </header>

      <StocktakeManager />
    </div>
  );
}
