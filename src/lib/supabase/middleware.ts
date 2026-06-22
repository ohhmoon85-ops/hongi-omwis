import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { UserRole } from '@/types';

// 역할별 허용 경로 prefix
const ROLE_ROUTES: Record<UserRole, string[]> = {
  chairman:    ['/chairman'],
  super_admin: ['/admin', '/chairman'],
  admin:       ['/admin'],
  driver:      ['/admin/deliveries'],
  customer:    ['/customer'],
};

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/api/health'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  // Supabase 미설정 시: 인증 검사 우회 (Phase 1 초기 mock 동작)
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

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
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // 비로그인 → /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 로그인 상태에서 /login 접근 → 본인 홈으로
  if (user && path === '/login') {
    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const role = (profile?.role ?? 'customer') as UserRole;
    const home = role === 'chairman' ? '/chairman/monitor'
               : role === 'customer' ? '/customer/order'
               : '/admin/dashboard';
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  // 로그인 상태 + 보호 경로 → 역할 검사
  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const role = (profile?.role ?? 'customer') as UserRole;
    const allowed = ROLE_ROUTES[role] ?? [];
    const ok = path === '/' || allowed.some((prefix) => path.startsWith(prefix));
    if (!ok) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'forbidden');
      return NextResponse.redirect(url);
    }
  }

  return response;
}
