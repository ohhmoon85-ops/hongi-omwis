// ============================================================================
// POST /api/inspections — 검수 저장 (+ PASS 시 재고 lot 자동 생성 옵션)
// GET  /api/inspections — 검수 이력 목록 (admin/super_admin/chairman)
// ----------------------------------------------------------------------------
// PASS 시 register_inventory: true → inventory INSERT + inspections.inventory_id 연결
// FAIL 시 register_inventory 무시. 관리자에게 iqc_fail 알림 발송.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isDevMode } from '@/lib/dev-data';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

interface InspectionBody {
  product_id: string;
  lot_number: string;
  supplier?: string | null;
  coil_count?: number | null;
  inspector?: string | null;
  inspected_at?: string;

  thickness_points?: (number | null)[];
  thickness_tol?: number;
  width_measured?: number | null;
  weight_measured?: number | null;

  mill_checks: Array<{ q: string; r: 'ok' | 'ng' | null; hint?: string }>;
  look_checks: Array<{ q: string; r: 'ok' | 'ng' | null; hint?: string }>;

  photo_urls?: string[];
  memo?: string | null;
  verdict: 'PASS' | 'FAIL';

  // PASS 시 자동으로 재고 lot 생성 (일반 케이스)
  register_inventory?: boolean;
  quantity_kg?: number;  // register_inventory=true 시 필수
}

export async function POST(req: NextRequest) {
  if (isDevMode) {
    return apiError('validation', '개발 모드 미지원 (localStorage 로 저장됩니다)');
  }

  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError('unauthorized');

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return apiError('forbidden', '관리자만 검수 저장할 수 있습니다');
  }

  const body = (await req.json()) as InspectionBody;
  if (!body.product_id || !body.lot_number?.trim() || !body.verdict) {
    return apiError('validation', 'product_id · lot_number · verdict 필수');
  }

  const admin = createAdminClient();

  // ─ 1) 검수 인서트 ────────────────────────────────────────────────────
  const { data: insp, error: iErr } = await admin
    .from('inspections')
    .insert({
      product_id: body.product_id,
      lot_number: body.lot_number.trim(),
      supplier: body.supplier ?? null,
      coil_count: body.coil_count ?? null,
      inspector: body.inspector ?? null,
      inspected_at: body.inspected_at ?? new Date().toISOString().slice(0, 10),
      thickness_points: body.thickness_points ?? null,
      thickness_tol: body.thickness_tol ?? 0.005,
      width_measured: body.width_measured ?? null,
      weight_measured: body.weight_measured ?? null,
      mill_checks: body.mill_checks ?? [],
      look_checks: body.look_checks ?? [],
      photo_urls: body.photo_urls ?? [],
      memo: body.memo ?? null,
      verdict: body.verdict,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (iErr || !insp) return apiError('internal', '검수 저장 실패', iErr?.message);

  // ─ 2) PASS + register_inventory → inventory lot 생성 ─────────────────
  let inventoryId: string | null = null;
  if (body.verdict === 'PASS' && body.register_inventory) {
    const qty = Number(body.quantity_kg);
    if (!qty || qty <= 0) {
      return apiError('validation', '재고 등록 시 quantity_kg (kg) 필수');
    }

    const { data: lot, error: invErr } = await admin
      .from('inventory')
      .insert({
        product_id: body.product_id,
        lot_number: body.lot_number.trim(),
        quantity: qty,
        initial_quantity: qty,
        import_date: body.inspected_at ?? new Date().toISOString().slice(0, 10),
        status: 'active',
      })
      .select('id')
      .single();
    if (invErr || !lot) return apiError('internal', '재고 등록 실패', invErr?.message);
    inventoryId = lot.id;

    // 역참조 저장
    await admin
      .from('inspections')
      .update({ inventory_id: inventoryId })
      .eq('id', insp.id);

    // inventory_logs 기록 (입고)
    await admin.from('inventory_logs').insert({
      inventory_id: inventoryId,
      product_id: body.product_id,
      log_type: 'in',
      quantity: qty,
      memo: `IQC PASS (검수 ${insp.id.slice(0, 8)})`,
      created_by: user.id,
    });
  }

  return NextResponse.json({
    ok: true,
    inspection_id: insp.id,
    inventory_id: inventoryId,
    verdict: body.verdict,
  });
}

export async function GET() {
  if (isDevMode) {
    return NextResponse.json([], { status: 200 });
  }

  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError('unauthorized');

  const { data, error } = await supabase
    .from('inspections')
    .select('*, products(name, type, thickness, width)')
    .order('inspected_at', { ascending: false });
  if (error) return apiError('internal', '검수 조회 실패', error.message);

  return NextResponse.json(data);
}
