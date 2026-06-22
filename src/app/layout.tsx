import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OMWIS — (주)홍지 주문·배송·창고·재고 관리',
  description: '폐쇄형 주문·배송·창고·재고 관리 시스템 (Order Management & Warehouse Intelligence System)',
  robots: 'noindex, nofollow', // 폐쇄형: 외부 검색엔진 노출 차단
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
