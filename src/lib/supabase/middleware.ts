import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { UserRole } from '@/types';
import { isSupabaseConfigured } from '@/lib/env';

// 역할별 허용 경로 prefix
// /account 는 모든 인증 사용자가 접근 가능 (본인 비번 변경)
// /admin/acis 는 외부 ACIS 사이트로 리다이렉트 — 회장도 접근 허용
const ROLE_ROUTES: Record<UserRole, string[]> = {
  chairman:    ['/chairman', '/account', '/admin/acis'],
  super_admin: ['/admin', '/chairman', '/account'],
  admin:       ['/admin', '/account'],
  customer:    ['/customer', '/account'],
};

const ROLE_HOME: Record<UserRole, string> = {
  chairman:    '/chairman/monitor',
  super_admin: '/admin/dashboard',
  admin:       '/admin/dashboard',
  customer:    '/customer/order',
};

// /api/* 는 각 라우트가 자체적으로 getUser()+역할을 검증하므로 미들웨어 역할
// 게이트에서 제외한다 (역할 prefix 에 안 걸려 forbidden 되는 것을 방지).
// /forgot-password /reset-password 는 비로그인 사용자도 접근 가능해야 함.
const PUBLIC_PATHS = [
  '/login', '/forgot-password', '/reset-password',
  '/_next', '/favicon.ico', '/api',
];

function isPathAllowed(path: string, role: UserRole): boolean {
  if (path === '/') return true;
  return ROLE_ROUTES[role]?.some((prefix) => path.startsWith(prefix)) ?? false;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // ─── 개발 모드: Supabase 미설정 또는 placeholder 값 ─────────────
  // dev_mock_role 쿠키로 역할 시뮬레이션
  if (!isSupabaseConfigured()) {
    const mockRole = request.cookies.get('dev_mock_role')?.value as UserRole | undefined;

    // 비로그인 상태 + 보호 경로 → /login
    if (!mockRole && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 개발 모드는 /login 으로 자유 이동 허용 (역할 전환 편의)
    // 운영 모드와 달리 자동 리다이렉트하지 않음

    // 로그인 상태 + 권한 외 경로 → /login?reason=forbidden
    if (mockRole && !isPublic && !isPathAllowed(path, mockRole)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'forbidden');
      return NextResponse.redirect(url);
    }

    return response;
  }

  // ─── 운영 모드: Supabase 세션 검증 ─────────────────────────────
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && path === '/login') {
    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const role = (profile?.role ?? 'customer') as UserRole;
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOME[role];
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const role = (profile?.role ?? 'customer') as UserRole;
    if (!isPathAllowed(path, role)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'forbidden');
      return NextResponse.redirect(url);
    }
  }

  return response;
}
