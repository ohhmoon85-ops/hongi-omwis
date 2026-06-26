import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OMWIS — (주)홍지 주문·배송·창고·재고 관리',
  description: '폐쇄형 주문·배송·창고·재고 관리 시스템 (Order Management & Warehouse Intelligence System)',
  robots: 'noindex, nofollow', // 폐쇄형: 외부 검색엔진 노출 차단
};

// 첫 페인트 전에 localStorage 의 테마 값을 html 에 적용 → FOUC (다크 → 라이트 깜빡임) 방지
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('omwis-theme');
    if (t === 'light') document.documentElement.classList.add('omwis-light');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
