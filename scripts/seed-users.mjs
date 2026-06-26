// ============================================================================
// OMWIS 시드 유저 생성·정리 스크립트 (멱등)
// ----------------------------------------------------------------------------
// 사전 조건: Supabase SQL Editor 에 supabase/schema.sql 또는 run-all.sql 적용
// 실행 방법: node --env-file=.env.local scripts/seed-users.mjs
// ----------------------------------------------------------------------------
// 이 스크립트가 하는 일:
//   1) OBSOLETE_EMAILS — 구버전 시드의 흔적 자동 정리
//   2) USERS — 정본 5계정을 생성·갱신 (모두 비번 1234)
//   3) 거래처 회사명으로 customer_id 자동 매칭
//   4) 모든 단계가 멱등 — 여러 번 실행해도 안전
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

// ⚠️ 개발 단계 — 모든 계정 비밀번호 1234 통일 (운영 전환 시 각자 변경)
const DEV_PASSWORD = '1234';

// ─── 정본 5계정 — 모두 @hongi.co.kr / @samscb.kr 통일 ──────────────────────
const USERS = [
  { email: 'chairman@hongi.co.kr', password: DEV_PASSWORD, role: 'chairman',    name: '홍지 회장' },
  { email: 'admin@hongi.co.kr',    password: DEV_PASSWORD, role: 'super_admin', name: '변지수 (대표)' },
  { email: 'ops@hongi.co.kr',      password: DEV_PASSWORD, role: 'admin',       name: '운영 직원' },
  { email: 'driver@hongi.co.kr',   password: DEV_PASSWORD, role: 'driver',      name: '이배송' },
  { email: 'customer@samscb.kr',   password: DEV_PASSWORD, role: 'customer',    name: '김민수',
    customer_company: '(주)삼성회로기판' },
];

// ─── 자동 정리: 구버전 시드의 흔적 ─────────────────────────────────────────
// 같은 역할을 위 USERS 목록에서 다른 이메일로 통합했기 때문에 정리 대상.
// 정본과 충돌하지 않는 사용자 정의 계정은 영향 받지 않음.
const OBSOLETE_EMAILS = [
  'byun@hongi.co.kr',     // → admin@hongi.co.kr (super_admin)
  'driver@hongi.test',    // → driver@hongi.co.kr
  'kim@samscb.kr',        // → customer@samscb.kr
  'chairman@hongi.test',  // → chairman@hongi.co.kr
  'admin@hongi.test',     // → ops@hongi.co.kr
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

async function listAllUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

function findUserByEmail(users, email) {
  return users.find((u) => u.email === email) ?? null;
}

async function createOrUpdateUser(users, { email, password, name }) {
  const existing = findUserByEmail(users, email);
  if (existing) {
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

async function deleteObsolete(users) {
  const targets = OBSOLETE_EMAILS
    .map((email) => ({ email, user: findUserByEmail(users, email) }))
    .filter((t) => t.user);

  if (targets.length === 0) {
    console.log('🧹 정리 대상 없음 (이미 깨끗)');
    return;
  }

  console.log(`🧹 구버전 시드 ${targets.length}개 자동 정리`);
  for (const { email, user } of targets) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) console.warn(`  ❌ ${email}: ${error.message}`);
    else       console.log(`  🗑️  ${email}`);
  }
  console.log('');
}

async function main() {
  console.log('🌱 OMWIS 시드 유저 생성·정리');
  console.log(`📡 Supabase: ${SUPABASE_URL}`);
  console.log('');

  // 1) 구버전 정리
  let users = await listAllUsers();
  await deleteObsolete(users);

  // 2) 정본 5계정 생성/갱신 (목록 다시 가져오기 — 정리 후 상태 반영)
  users = await listAllUsers();
  let success = 0;
  let failed  = 0;

  for (const u of USERS) {
    const tag = `[${u.role.padEnd(12)}] ${u.email.padEnd(28)}`;
    try {
      const { id, created } = await createOrUpdateUser(users, u);

      let customerId = null;
      if (u.customer_company) {
        customerId = await ensureCustomerId(u.customer_company);
        if (!customerId) {
          console.warn(`${tag} ⚠️ 거래처 "${u.customer_company}" 미존재`);
          console.warn('  → schema.sql 의 거래처 시드가 적용되었는지 확인하세요');
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
  console.log('┌─────────────────────────────────┬───────────┬─────────────────┐');
  console.log('│ 이메일                            │ 비밀번호  │ 역할             │');
  console.log('├─────────────────────────────────┼───────────┼─────────────────┤');
  for (const u of USERS) {
    console.log(`│ ${u.email.padEnd(31)} │ ${u.password.padEnd(9)} │ ${u.role.padEnd(15)} │`);
  }
  console.log('└─────────────────────────────────┴───────────┴─────────────────┘');
  console.log('');
  console.log('💡 비밀번호는 임시값입니다. 운영 전환 시 각자 변경하세요.');
}

main().catch((err) => {
  console.error('\n💥 치명적 오류:', err);
  process.exit(1);
});
