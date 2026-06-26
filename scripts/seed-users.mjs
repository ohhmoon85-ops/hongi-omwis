// ============================================================================
// OMWIS 시드 유저 생성 스크립트
// ----------------------------------------------------------------------------
// 사전 조건: Supabase SQL Editor 에 supabase/schema.sql 적용 완료
// 실행 방법: node --env-file=.env.local scripts/seed-users.mjs
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ .env.local 에 다음 두 키가 필요합니다:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('실행: node --env-file=.env.local scripts/seed-users.mjs');
  process.exit(1);
}

// Node 20 에서 native WebSocket 부재 → ws 패키지 주입 (realtime 사용 안 해도 초기화 시 요구)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

const USERS = [
  { email: 'chairman@hongi.test', password: 'chairman1234', role: 'chairman',    name: '홍지 회장' },
  { email: 'byun@hongi.co.kr',    password: 'byun1234',     role: 'super_admin', name: '변지수 (대표)' },
  { email: 'admin@hongi.test',    password: 'admin1234',    role: 'admin',       name: '운영 직원' },
  { email: 'driver@hongi.test',   password: 'driver1234',   role: 'driver',      name: '배송 직원' },
  { email: 'kim@samscb.kr',       password: 'kim1234',      role: 'customer',    name: '김민수',
    customer_company: '(주)삼성회로기판' },
];

async function ensureCustomerId(companyName) {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('company_name', companyName)
    .maybeSingle();
  if (error) {
    console.warn(`  ⚠️ customers 조회 실패: ${error.message}`);
    return null;
  }
  return data?.id ?? null;
}

async function findUserByEmail(email) {
  // listUsers 는 페이지네이션 — 1000명까지 한 번에 조회 (OMWIS 초기 규모 충분)
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function createOrUpdateUser({ email, password, name }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    // 비밀번호 재설정 (멱등 실행을 위해)
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { name },
    });
    if (error) throw error;
    return { id: existing.id, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  return { id: data.user.id, created: true };
}

async function upsertProfile(userId, role, name, customerId) {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, role, name, customer_id: customerId });
  if (error) throw error;
}

async function main() {
  console.log('🌱 OMWIS 시드 유저 생성');
  console.log(`📡 Supabase: ${SUPABASE_URL}`);
  console.log('');

  let success = 0;
  let failed  = 0;

  for (const u of USERS) {
    const tag = `[${u.role.padEnd(12)}] ${u.email.padEnd(28)}`;
    try {
      const { id, created } = await createOrUpdateUser(u);

      let customerId = null;
      if (u.customer_company) {
        customerId = await ensureCustomerId(u.customer_company);
        if (!customerId) {
          console.warn(`${tag} ⚠️ 거래처 "${u.customer_company}" 미존재`);
          console.warn(`  → schema.sql 의 INSERT INTO customers ... 시드가 적용되었는지 확인하세요`);
        }
      }

      await upsertProfile(id, u.role, u.name, customerId);
      console.log(`${tag} ${created ? '✅ 신규생성' : '🔄 갱신   '} | 비번: ${u.password}`);
      success++;
    } catch (err) {
      console.error(`${tag} ❌ ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`완료: 성공 ${success} / 실패 ${failed}`);
  console.log('');
  console.log('📋 로그인 정보 요약:');
  console.log('┌─────────────────────────────────┬─────────────────┐');
  console.log('│ 이메일                           │ 비밀번호          │');
  console.log('├─────────────────────────────────┼─────────────────┤');
  for (const u of USERS) {
    console.log(`│ ${u.email.padEnd(31)} │ ${u.password.padEnd(15)} │  ← ${u.role}`);
  }
  console.log('└─────────────────────────────────┴─────────────────┘');
  console.log('');
  console.log('💡 비밀번호는 임시값입니다. 운영 전환 시 각자 변경하세요.');
}

main().catch((err) => {
  console.error('\n💥 치명적 오류:', err);
  process.exit(1);
});
