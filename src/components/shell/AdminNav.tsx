'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABEL, type UserRole } from '@/types';
import {
  LayoutDashboard, ClipboardList, Building2, Package, Truck, Bot, Bell, User, Users, LogOut,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { href: '/admin/dashboard',  label: '대시보드', icon: LayoutDashboard, roles: ['super_admin', 'admin'] },
  { href: '/admin/orders',     label: '주문',     icon: ClipboardList,  roles: ['super_admin', 'admin'] },
  { href: '/admin/customers',  label: '거래처',   icon: Building2,      roles: ['super_admin', 'admin'] },
  { href: '/admin/inventory',  label: '재고',     icon: Package,        roles: ['super_admin', 'admin'] },
  { href: '/admin/deliveries',   label: '배송',     icon: Truck,          roles: ['super_admin', 'admin', 'driver'] },
  { href: '/admin/notifications',label: '알림 이력', icon: Bell,           roles: ['super_admin', 'admin'] },
  { href: '/admin/users',        label: '사용자',   icon: Users,          roles: ['super_admin'] },
  { href: '/admin/acis',         label: 'ACIS',     icon: Bot,            roles: ['super_admin'] },
];

export function AdminNav({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  const router = useRouter();

  // ACIS 임베드는 풀스크린 — 내비게이션 숨김
  if (pathname === '/admin/acis') return null;

  const items = NAV.filter((n) => !role || n.roles.includes(role));

  async function logout() {
    try { await createClient().auth.signOut(); } catch { /* dev 모드 */ }
    document.cookie = 'dev_mock_role=; path=/; max-age=0';
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0b0d13]/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 sm:px-6 h-14">
        {/* 브랜드 */}
        <Link href="/admin/dashboard" className="flex items-baseline gap-2 mr-2 shrink-0">
          <span className="text-lg font-extrabold tracking-tight text-gold-gradient">OMWIS</span>
          <span className="hidden sm:inline text-[11px] text-gray-500">(주)홍지</span>
        </Link>

        {/* 메뉴 */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {items.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#c8962e]/15 text-[#e0bf70] ring-1 ring-[#c8962e]/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* 우측: 역할 + 내 계정 + 로그아웃 */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {role && (
            <span className="hidden sm:inline text-[11px] px-2 py-1 rounded-full bg-white/[0.05] text-gray-300 border border-white/[0.06]">
              {ROLE_LABEL[role]}
            </span>
          )}
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="내 계정"
            title="내 계정"
          >
            <User className="w-4 h-4" />
            <span className="hidden lg:inline">내 계정</span>
          </Link>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="로그아웃"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </div>
    </header>
  );
}
