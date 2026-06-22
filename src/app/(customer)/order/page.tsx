import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CustomerOrderPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] p-4 sm:p-6 text-[#1c1c1c]">
      <header className="mb-6">
        <div className="text-sm text-[#1a3d6b] font-semibold">OMWIS · 거래처 주문</div>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">주문하기</h1>
        <p className="text-sm text-gray-600 mt-1">
          (주)홍지 본사에 직접 주문 — 품목·수량·납기를 입력하세요
        </p>
      </header>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>주문 폼 (Phase 2 에서 완성 예정)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600">
            현재 Phase 1: 인증 + 권한 + 라우팅 기반 구축 완료.<br />
            Phase 2 에서 다음 기능이 추가됩니다:
          </div>
          <ul className="text-sm list-disc list-inside text-gray-700 space-y-1">
            <li>품목(생/지용성/수용성) 선택 + 두께·폭·수량 입력</li>
            <li>납기 요청일 캘린더</li>
            <li>거래처별 개별 단가 자동 적용</li>
            <li>주문 미리보기 → 제출 → 카카오 알림톡 자동 발송</li>
            <li>과거 주문 이력 + 클릭 한 번 재주문</li>
          </ul>
          <Button disabled className="mt-2">주문 폼 준비 중</Button>
        </CardContent>
      </Card>
    </div>
  );
}
