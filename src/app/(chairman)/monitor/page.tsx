import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// 👑 회장 전용 모니터링 대시보드 — Read-Only
// ⚠️ 이 화면에는 어떤 편집·생성·삭제 UI 도 두지 말 것
//    버튼은 "새로고침" 같은 표시 동작용만 허용
export default function ChairmanMonitorPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#c8962e]">
            👑 회장 모니터링 대시보드
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            전사 현황을 실시간 열람 — 모든 데이터는 Read-Only
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-[#c8962e]/15 text-[#c8962e] border border-[#c8962e]/30">
          Read-Only
        </span>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <PlaceholderCard title="📊 매출 현황" subtitle="일/월/분기/연 매출 + 전년 대비" />
        <PlaceholderCard title="📦 주문·배송" subtitle="신규 주문, 진행/완료 배송 요약" />
        <PlaceholderCard title="📋 재고 현황" subtitle="품목별 현재고 + 안전재고 미달" />
        <PlaceholderCard title="💰 수금·미수금" subtitle="거래처별 미수금, 한도 초과" />
        <PlaceholderCard title="🤖 ACIS 신호" subtitle="BUY/HOLD 등 + 수입 원가 동향" />
        <PlaceholderCard title="🏢 거래처 순위" subtitle="이달 매출 상위 거래처" />
      </div>

      <footer className="mt-8 text-center text-xs text-gray-500">
        Phase 4 에서 실데이터 연동 예정 — 현재는 placeholder 표시
      </footer>
    </div>
  );
}

function PlaceholderCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="bg-[#171b26] border-[#1f2433] text-white">
      <CardHeader>
        <CardTitle className="text-base text-gray-200">{title}</CardTitle>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="text-2xl sm:text-3xl font-bold text-[#c8962e]">—</div>
        <div className="text-xs text-gray-500 mt-2">데이터 연동 대기</div>
      </CardContent>
    </Card>
  );
}
