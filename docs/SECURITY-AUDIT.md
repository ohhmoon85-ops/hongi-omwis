# OMWIS 권한·보안 점검 (RLS 침투 테스트 + UI 잠금 검증)

## 다층 방어 구조

OMWIS 는 **3중 게이트** 로 권한을 강제합니다 — 하나가 뚫려도 다음 층이 막음.

1. **미들웨어** `src/lib/supabase/middleware.ts` — URL prefix 기반 라우트 차단
2. **API 자체 검증** — 각 라우트가 `getUser()` + role 확인
3. **RLS 정책** `supabase/schema.sql` — DB 행 단위 SELECT/INSERT/UPDATE/DELETE 제어

## 1) 미들웨어 라우트 매트릭스

```
ROLE_ROUTES (src/lib/supabase/middleware.ts):
  chairman:    ['/chairman']
  super_admin: ['/admin', '/chairman']
  admin:       ['/admin']
  driver:      ['/admin/deliveries']   ← admin 하위 1개만
  customer:    ['/customer']

PUBLIC_PATHS: ['/login', '/_next', '/favicon.ico', '/api']
```

### 침투 시나리오 vs 동작

| 시도 | 결과 | 검증 위치 |
|---|---|---|
| 비로그인 → `/admin/dashboard` | → `/login` | `if (!user && !isPublic)` |
| 거래처 → `/admin/orders` | → `/login?reason=forbidden` | `isPathAllowed` |
| 거래처 → `/chairman/monitor` | → forbidden | `isPathAllowed` |
| 회장 → `/admin/dashboard` | → forbidden | ROLE_ROUTES 에 `/admin` 없음 |
| 회장 → `/admin/customers/new` | → forbidden | 동일 |
| 운영 직원 → `/chairman/monitor` | → forbidden | ROLE_ROUTES 에 `/chairman` 없음 |
| 배송 기사 → `/admin/orders` | → forbidden | driver 는 `/admin/deliveries` 만 |
| 배송 기사 → `/admin/inventory` | → forbidden | 동일 |
| 슈퍼관리자 → 모든 `/admin/*`, `/chairman/*` | ✓ 통과 | 양쪽 prefix 다 매칭 |

## 2) API 자체 검증 매트릭스

| 라우트 | 허용 역할 | 검증 코드 |
|---|---|---|
| `POST /api/orders` | customer (자사 주문) | `profile.role !== 'customer'` 차단 |
| `GET /api/orders` | 전 역할 (RLS 가 필터) | `createClient()` 사용 → RLS 적용 |
| `PATCH /api/deliveries` | driver / admin / super_admin | role 명시 검사 |
| `POST /api/invoices` | super_admin / admin | role 명시 검사 |
| `POST /api/biz/verify` | super_admin / admin | role 명시 검사 |
| `GET /api/cron/weekly-summary` | Vercel Cron 전용 | `Authorization: Bearer CRON_SECRET` |
| `GET /api/cron/daily-summary` | Vercel Cron 전용 | 동일 |

### 핵심 패턴

- **createClient()** = 사용자 쿠키 기반, RLS 자동 적용 → 권한 외 데이터 자동 차단
- **createAdminClient()** = service_role, RLS 우회 → 반드시 API 단에서 role 검증 후 사용
- 모든 cron 은 `CRON_SECRET` 헤더 없으면 401

## 3) RLS 정책 매트릭스

### chairman (회장 — Read-Only)

```
chair_read_customers / products / orders / oitems / inventory / invlogs / deliveries / invoices
  ↳ FOR SELECT USING current_role_v() = 'chairman'
```

⚠️ **INSERT/UPDATE/DELETE 정책 0건** — 회장 계정은 DB 수정 절대 불가

### super_admin / admin (관리자)

```
admin_all_customers / products / cprices / orders / oitems / inventory / invlogs / deliveries / notify / safety / invoices
  ↳ FOR ALL USING current_role_v() IN ('super_admin','admin')
```

### driver (배송 기사)

```
driver_read_deliveries: FOR SELECT USING role='driver'
driver_update_deliveries: FOR UPDATE USING role='driver'
driver_read_orders: FOR SELECT USING role='driver'
```

⚠️ **INSERT/DELETE 정책 없음** — 배송 기사는 새 배송 생성·삭제 불가

### customer (거래처)

```
cust_read_own_orders: USING customer_id = current_customer_id()
cust_create_orders:   WITH CHECK customer_id = current_customer_id()
cust_read_own_oitems: order_id 가 자사 주문 안에
cust_create_oitems:   동일
cust_read_own_deliveries: 동일
cust_read_products:   is_active = true
cust_read_own_prices: customer_id = current_customer_id()
cust_read_own_invoices: 동일
```

⚠️ **다른 거래처 데이터 SELECT 절대 불가** — `current_customer_id()` 가 본인 ID 만 반환

## 4) 침투 테스트 시나리오 — 검증된 차단

### S1. 회장이 데이터 수정 시도

- UI: `/chairman/monitor` 에 수정 버튼 0개 → 시도 불가
- 직접 SQL 호출 시도 (개발자 도구로 fetch): RLS `chair_*` 정책에 INSERT 없음 → DB 차단
- 미들웨어가 회장의 `/admin/*` 접근 자체를 막음 → 관리자 UI 도달 불가

### S2. 거래처 A 가 거래처 B 주문 조회

- 직접 GET `/api/orders` 호출: `cust_read_own_orders` RLS 가 `current_customer_id()` 일치만 SELECT → 0행 반환
- 직접 SQL 시도: 동일 — RLS 가 자사 데이터만 노출

### S3. 배송 기사가 거래처 정보 조회

- `/api/orders` 의 GET → driver_read_orders 로 주문은 SELECT 가능 (배송에 필요)
- customers 테이블 SELECT: chairman/admin 정책에만 포함 — driver 는 SELECT 불가
- driver_read_deliveries 가 customers JOIN 결과만 제공 (배송지·담당자명 한정)

### S4. 비로그인 사용자가 API 직접 호출

- 모든 API 가 `supabase.auth.getUser()` 로 검사 → 401 반환
- cron 라우트는 `CRON_SECRET` 없이 401

### S5. 운영 직원(admin) 이 cron 트리거 시도

- `GET /api/cron/weekly-summary` 호출 → CRON_SECRET 헤더 없으면 401
- 헤더 있어도 admin 이 CRON_SECRET 알 수 없으면 401
- 권한 분리 유지

## 5) 보강된 항목 (이번 점검에서 발견·수정)

### 5.1 `/api/orders` POST — 명시적 role 검증 추가 (커밋: SECURITY-AUDIT 동반 commit)

**전**: `customer_id` 만 검사 — 다른 역할이 customer_id 가 있으면 통과 가능 (RLS 우회 service_role 사용)

**후**: `profile.role !== 'customer'` 차단 추가

```ts
if (!profile || profile.role !== 'customer') {
  return NextResponse.json({ error: 'customer role required' }, { status: 403 });
}
```

## 6) 권장 운영 절차

### 새 라우트 추가 시 체크리스트

- [ ] `src/app/(role)/...` 경로가 ROLE_ROUTES 의 prefix 와 일치하는가?
- [ ] API 라우트면 첫 줄에 `getUser()` + role 검사 추가했는가?
- [ ] `createAdminClient()` 를 쓴다면 그 위에 명시적 role 차단이 있는가?
- [ ] 새 테이블이면 schema.sql 에 RLS 정책 5가지(chairman/admin/driver/customer 각 + super_admin) 모두 검토했는가?
- [ ] 회장 정책에 INSERT/UPDATE/DELETE 가 들어가지 않았는가?

### 정기 점검 (분기 1회 권장)

```sql
-- chairman 정책이 SELECT 외에 다른 동작을 허용하는지 검사
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE policyname LIKE 'chair%'
  AND cmd != 'SELECT';
-- 결과 0행이어야 정상
```

```sql
-- RLS 가 활성화되지 않은 public 테이블이 있는지
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables t
    WHERE EXISTS (SELECT 1 FROM pg_class c
      WHERE c.relname = t.tablename AND c.relrowsecurity = true)
  );
-- 결과 0행이어야 정상
```

## 7) 알려진 의도적 권한 폭

- **driver 가 orders 전체 SELECT 가능**: 배송 시 주문 정보 확인 필요. 추후 본인 배차분만 보이도록 좁힐 수 있음.
- **모든 역할이 products SELECT 가능**: 가격은 customer_prices 로 분리되어 다른 거래처 가격은 보이지 않음.
- **chairman 이 모든 customer 정보 SELECT**: 경영 모니터링 목적. 수정은 절대 불가.

---

**최종 점검일**: 이 문서가 생성된 시점
**다음 점검**: 분기 1회 권장 또는 새 역할/테이블 추가 시
