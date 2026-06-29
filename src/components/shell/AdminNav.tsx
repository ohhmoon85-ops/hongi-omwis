'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABEL, type UserRole } from '@/types';
import {
  LayoutDashboard, ClipboardList, Building2, Package, Tag, Bot, Bell,
  User, Users, LogOut, Menu, X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  external?: boolean;
}

const NAV: NavItem[] = [
  { href: '/admin/dashboard',    label: '대시보드',  icon: LayoutDashboard, roles: ['super_admin', 'admin'] },
  { href: '/admin/orders',       label: '주문',     icon: ClipboardList,  roles: ['super_admin', 'admin'] },
  { href: '/admin/customers',    label: '거래처',   icon: Building2,      roles: ['super_admin', 'admin'] },
  { href: '/admin/products',     label: '품목',     icon: Tag,            roles: ['super_admin', 'admin'] },
  { href: '/admin/inventory',    label: '재고',     icon: Package,        roles: ['super_admin', 'admin'] },
  { href: '/admin/notifications',label: '알림 이력', icon: Bell,           roles: ['super_admin', 'admin'] },
  { href: '/admin/users',        label: '사용자',   icon: Users,          roles: ['super_admin'] },
  { href: '/admin/acis',         label: 'ACIS',     icon: Bot,            roles: ['super_admin', 'admin'], external: true },
];

export function AdminNav({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !role || n.roles.includes(role));

  async function logout() {
    try { await createClient().auth.signOut(); } catch { /* dev 모드 */ }
    document.cookie = 'dev_mock_role=; path=/; max-age=0';
    router.push('/login');
    router.refresh();
  }

  function linkClasses(active: boolean) {
    return `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? 'bg-[#c8962e]/15 text-[#e0bf70] ring-1 ring-[#c8962e]/30'
        : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
    }`;
  }

  function renderLink(n: NavItem, onClick?: () => void) {
    const active = !n.external && pathname.startsWith(n.href);
    const Icon = n.icon;
    const inner = (<><Icon className="w-4 h-4" />{n.label}</>);
    return n.external ? (
      <a key={n.href} href={n.href} target="_blank" rel="noopener noreferrer"
        onClick={onClick} className={linkClasses(false)}>{inner}</a>
    ) : (
      <Link key={n.href} href={n.href} onClick={onClick} className={linkClasses(active)}>{inner}</Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0b0d13]/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 sm:px-6 h-14">
        {/* 브랜드 */}
        <Link href="/admin/dashboard" onClick={() => setOpen(false)} className="flex items-baseline gap-2 mr-2 shrink-0">
          <span className="text-lg font-extrabold tracking-tight text-gold-gradient">OMWIS</span>
          <span className="hidden sm:inline text-[11px] text-gray-500">(주)홍지</span>
        </Link>

        {/* 데스크톱 메뉴 (md 이상) */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          {items.map((n) => renderLink(n))}
        </nav>

        {/* 데스크톱 우측 (md 이상) */}
        <div className="hidden md:flex ml-auto items-center gap-2 shrink-0">
          {role && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-white/[0.05] text-gray-300 border border-white/[0.06]">
              {ROLE_LABEL[role]}
            </span>
          )}
          <ThemeToggle variant="dark" />
          <Link href="/account" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors" title="내 계정">
            <User className="w-4 h-4" />
            <span className="hidden lg:inline">내 계정</span>
          </Link>
          <button onClick={logout} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors" aria-label="로그아웃">
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline">로그아웃</span>
          </button>
        </div>

        {/* 모바일 햄버거 (md 미만) */}
        <div className="md:hidden ml-auto flex items-center gap-1">
          <ThemeToggle variant="dark" />
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 text-gray-300 hover:text-white"
            aria-label="메뉴"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0b0d13]/95 px-3 py-3">
          {role && (
            <div className="px-2 pb-2 mb-2 border-b border-white/[0.06] text-[11px] text-gray-400">
              {ROLE_LABEL[role]} 로 로그인됨
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((n) => renderLink(n, () => setOpen(false)))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-2">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            >
              <User className="w-4 h-4" /> 내 계정
            </Link>
            <button
              onClick={logout}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-300 border border-red-500/30 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
