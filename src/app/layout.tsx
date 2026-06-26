import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OMWIS — (주)홍지 주문·배송·창고·재고 관리',
  description: '폐쇄형 주문·배송·창고·재고 관리 시스템 (Order Management & Warehouse Intelligence System)',
  robots: 'noindex, nofollow', // 폐쇄형: 외부 검색엔진 노출 차단
};

// 첫 페인트 전에 테마 결정 → FOUC (다크 ↔ 라이트 깜빡임) 방지
// 1) localStorage 'omwis-theme-mode' = 'auto'|'light'|'dark' 확인
// 2) 'auto' 또는 미설정이면 현재 시각으로 결정 (07:00~18:59 = 라이트)
// 3) 'light'/'dark' 는 그대로 적용
const themeInitScript = `
(function() {
  try {
    var m = localStorage.getItem('omwis-theme-mode');
    // 구버전 키 호환
    if (!m) m = localStorage.getItem('omwis-theme');
    var light;
    if (m === 'light') light = true;
    else if (m === 'dark') light = false;
    else {
      var h = new Date().getHours();
      light = (h >= 7 && h < 19);
    }
    if (light) document.documentElement.classList.add('omwis-light');
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
