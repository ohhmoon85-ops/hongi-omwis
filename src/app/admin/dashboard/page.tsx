import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ACISCard } from '@/components/shared/ACISCard';

// KPI 5종 + ACIS = 총 6 카드
const KPI_CARDS = [
  { icon: '📦', title: '오늘의 주문', value: '-', desc: '실시간',         color: 'text-blue-400' },
  { icon: '🚛', title: '배송 현황',   value: '-', desc: '진행/완료',       color: 'text-green-400' },
  { icon: '📊', title: '이번 달 매출', value: '-', desc: '월 누계',         color: 'text-[#c8962e]' },
  { icon: '⚠️', title: '재고 경보',   value: '-', desc: '안전재고 미달',   color: 'text-red-400' },
  { icon: '💰', title: '미수금 현황',  value: '-', desc: '거래처별 총액',   color: 'text-orange-400' },
];

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-gray-400 mt-1">매일 아침 핵심 경영 지표 한눈에</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {KPI_CARDS.map((c) => (
          <Card key={c.title} className="bg-[#171b26] border-[#1f2433] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-300">
                <span className="mr-2">{c.icon}</span>{c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
            </CardContent>
          </Card>
        ))}
        <ACISCard />
      </div>

      <footer className="mt-8 text-xs text-gray-500">
        Phase 2 진행 중 — KPI 실데이터는 주문/배송 시스템 연결 후 표시됩니다.
      </footer>
    </div>
  );
}
