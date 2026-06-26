'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 인쇄 페이지 헤더의 「인쇄 / PDF 저장」 버튼 — 클라이언트 컴포넌트 분리
export default function InvoicePrintActions() {
  return (
    <Button
      onClick={() => window.print()}
      className="bg-[#1a3d6b] hover:bg-[#235490] text-white"
    >
      <Printer className="w-4 h-4 mr-1" />
      인쇄 / PDF 저장
    </Button>
  );
}
