import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { AdminNav } from '@/components/shell/AdminNav';
import type { UserRole } from '@/types';

async function getRole(): Promise<UserRole | null> {
  if (isDevMode) {
    return (cookies().get('dev_mock_role')?.value as UserRole) ?? null;
  }
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    return (data?.role as UserRole) ?? null;
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  return (
    <div className="min-h-screen bg-app text-white">
      <AdminNav role={role} />
      {children}
    </div>
  );
}
