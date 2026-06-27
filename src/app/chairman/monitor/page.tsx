import Link from 'next/link';
import { User, Bot } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ACISCard } from '@/components/shared/ACISCard';
import { ChairmanCharts } from '@/components/chairman/ChairmanCharts';
import { MarketsWidget } from '@/components/chairman/MarketsWidget';
import { LogoutButton } from '@/components/shared/LogoutButton';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

// 👑 회장 전용 모니터링 대시보드 — Read-Only
// ⚠️ 이 화면에는 어떤 편집·생성·삭제 UI 도 두지 말 것
export default function ChairmanMonitorPage() {
  return (
    <div className="min-h-screen bg-app p-4 sm:p-6 text-white">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
            👑 회장 모니터링
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">(주)홍지</h1>
          <p className="text-sm text-gray-400 mt-1">
            전사 현황을 실시간 열람 — 모든 데이터는 Read-Only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-[#c8962e]/15 text-[#c8962e] border border-[#c8962e]/30">
            Read-Only
          </span>
          <ThemeToggle variant="dark" />
          <a
            href="/admin/acis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.06] transition"
            title="ACIS 새 탭에서 열기"
          >
            <Bot className="w-4 h-4" />
            ACIS
          </a>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.06] transition"
            title="내 계정"
          >
            <User className="w-4 h-4" />
            내 계정
          </Link>
          <LogoutButton variant="dark" />
        </div>
      </header>

      {/* KPI / ACIS / 보조 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <PlaceholderCard title="📋 재고 현황" subtitle="품목별 현재고 + 안전재고 미달" />
        <PlaceholderCard title="💰 수금·미수금" subtitle="거래처별 미수금, 한도 초과" />
        <ACISCard />
      </div>

      {/* 환율/원자재 시세 위젯 — ACIS 시계열 */}
      <div className="mb-6">
        <MarketsWidget />
      </div>

      {/* 차트 섹션 — 매출 추세 / 거래처 순위 / 주문 상태 */}
      <ChairmanCharts />

      <footer className="mt-8 text-center text-xs text-gray-500">
        경영 지표는 단계적 실데이터 연동 중 — ACIS 구매 신호는 실시간 연동됨
      </footer>
    </div>
  );
}

function PlaceholderCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
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
