'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { upsertDevCustomer, deactivateDevCustomer, reactivateDevCustomer, PRICE_TIER_OPTIONS } from '@/lib/dev-customers';
import { isDevMode } from '@/lib/dev-data';
import { formatKRW } from '@/lib/utils';
import type { Customer } from '@/types';

interface Props {
  initial?: Customer;          // 편집 모드면 채워짐, 신규면 undefined
  mode: 'create' | 'edit';
}

export function CustomerForm({ initial, mode }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<Customer>(initial ?? {
    id: crypto.randomUUID(),
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    delivery_address: '',
    price_tier: 'standard',
    credit_limit: 10000000,
    current_balance: 0,
    is_active: true,
    former_dealer: null,
    transferred_at: null,
    memo: null,
    created_at: '',
    updated_at: '',
  });
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof Customer>(key: K, value: Customer[K]) {
    setForm({ ...form, [key]: value });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error('회사명은 필수입니다');
      return;
    }
    setSubmitting(true);

    try {
      if (isDevMode) {
        upsertDevCustomer({
          ...form,
          // 납품지 미입력 시 본사 주소로 폴백
          delivery_address: form.delivery_address || form.address,
          // 이관 거래처면 transferred_at 자동 설정
          transferred_at: form.former_dealer
            ? form.transferred_at || new Date().toISOString()
            : null,
        });
        toast.success(mode === 'create' ? '거래처 등록 완료' : '저장 완료');
        setTimeout(() => router.push('/admin/customers'), 400);
      } else {
        // TODO: /api/customers POST/PATCH
        toast.error('운영 모드 API 준비 중');
        setSubmitting(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
      setSubmitting(false);
    }
  }

  function toggleActive() {
    if (!initial) return;
    if (initial.is_active) {
      if (!confirm(`${initial.company_name} 을 비활성화 합니다. 거래를 종료하시겠습니까?`)) return;
      deactivateDevCustomer(initial.id);
      toast('거래처 비활성화 완료', { icon: '⚠️' });
    } else {
      reactivateDevCustomer(initial.id);
      toast.success('거래처 활성화 완료');
    }
    setTimeout(() => router.push('/admin/customers'), 400);
  }

  return (
    <>
      <Toaster position="top-center" />

      <form onSubmit={onSubmit} className="space-y-4 max-w-3xl text-white">
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row>
              <Field label="회사명 *">
                <Input
                  value={form.company_name}
                  onChange={(e) => set('company_name', e.target.value)}
                  required
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                  placeholder="(주)홍지전자"
                />
              </Field>
              <Field label="담당자">
                <Input
                  value={form.contact_name ?? ''}
                  onChange={(e) => set('contact_name', e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                />
              </Field>
            </Row>

            <Row>
              <Field label="전화">
                <Input
                  value={form.phone ?? ''}
                  onChange={(e) => set('phone', e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                  placeholder="010-1234-5678"
                />
              </Field>
              <Field label="이메일 (로그인 ID)">
                <Input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => set('email', e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                  placeholder="contact@company.com"
                />
              </Field>
            </Row>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">주소</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="회사 주소">
              <Input
                value={form.address ?? ''}
                onChange={(e) => set('address', e.target.value)}
                className="bg-[#0f1117] border-[#2a2f3e] text-white"
              />
            </Field>
            <Field label="납품지 주소">
              <Input
                value={form.delivery_address ?? ''}
                onChange={(e) => set('delivery_address', e.target.value)}
                className="bg-[#0f1117] border-[#2a2f3e] text-white"
                placeholder="비워두면 회사 주소 사용"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">단가 등급 · 신용 한도</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row>
              <Field label="가격 등급">
                <select
                  value={form.price_tier}
                  onChange={(e) => set('price_tier', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm"
                >
                  {PRICE_TIER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label={`신용 한도 (현재 미수: ${formatKRW(form.current_balance)})`}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.credit_limit}
                  onChange={(e) => set('credit_limit', parseInt(e.target.value) || 0)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                />
              </Field>
            </Row>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">
              D2C 이관 이력 (대리점 거래처인 경우만 입력)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="기존 소속 대리점">
              <Input
                value={form.former_dealer ?? ''}
                onChange={(e) => set('former_dealer', e.target.value || null)}
                className="bg-[#0f1117] border-[#2a2f3e] text-white"
                placeholder="예: 서울대리점 (없으면 빈 칸)"
              />
            </Field>
            {form.former_dealer && (
              <p className="text-xs text-blue-400 mt-2">
                ℹ️ 이 거래처는 본사 직거래로 이관 처리되어 추후 매출 통계에 반영됩니다.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">
              사업자 정보 (세금계산서 발행용)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row>
              <Field label="사업자등록번호">
                <BizNumberInput
                  value={form.business_number ?? ''}
                  onChange={(v) => set('business_number', v || null)}
                />
              </Field>
              <Field label="대표자">
                <Input
                  value={form.ceo_name ?? ''}
                  onChange={(e) => set('ceo_name', e.target.value || null)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                />
              </Field>
            </Row>
            <Row>
              <Field label="업태">
                <Input
                  value={form.biz_type ?? ''}
                  onChange={(e) => set('biz_type', e.target.value || null)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                  placeholder="제조"
                />
              </Field>
              <Field label="종목">
                <Input
                  value={form.biz_item ?? ''}
                  onChange={(e) => set('biz_item', e.target.value || null)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white"
                  placeholder="전자부품"
                />
              </Field>
            </Row>
            <Field label="세금계산서 수신 이메일 (미입력 시 위 이메일 사용)">
              <Input
                type="email"
                value={form.tax_email ?? ''}
                onChange={(e) => set('tax_email', e.target.value || null)}
                className="bg-[#0f1117] border-[#2a2f3e] text-white"
                placeholder="tax@company.com"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base text-gray-200">메모 (선택)</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={form.memo ?? ''}
              onChange={(e) => set('memo', e.target.value || null)}
              rows={3}
              placeholder="결제 조건, 특이사항 등"
              className="w-full px-3 py-2 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm resize-none"
            />
          </CardContent>
        </Card>

        {/* 액션 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div>
            {mode === 'edit' && (
              <Button
                type="button"
                onClick={toggleActive}
                variant={initial?.is_active ? 'destructive' : 'outline'}
              >
                {initial?.is_active ? '거래 종료 (비활성화)' : '재활성화'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/customers')}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#1a3d6b] hover:bg-[#235490] text-white"
            >
              {submitting ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

// 사업자등록번호 입력 + 국세청 검증 버튼 — verifyBusinessNumber API 호출
function BizNumberInput({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [status, setStatus] = useState<
    null | { ok: boolean; label: string; mock: boolean; detail?: string }
  >(null);
  const [busy, setBusy] = useState(false);

  // 입력 변경 시 검증 결과 초기화
  function update(v: string) {
    onChange(v);
    if (status) setStatus(null);
  }

  async function verify() {
    if (!value.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/biz/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: value }),
      });
      const data = await res.json();
      if (!data.valid) {
        setStatus({
          ok: false,
          label: data.error ?? '미확인',
          mock: data.mock ?? false,
        });
        toast.error(data.error ?? '검증 실패');
        return;
      }
      setStatus({
        ok: true,
        label: data.mock ? '형식 OK (Mock)' : data.status,
        mock: data.mock,
        detail: data.taxType,
      });
      toast.success(data.mock ? '체크섬 통과 (실 조회는 API 키 설정 후)' : `${data.status} ${data.taxType ?? ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '검증 호출 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <Input
          value={value}
          onChange={(e) => update(e.target.value)}
          className="bg-[#0f1117] border-[#2a2f3e] text-white flex-1"
          placeholder="123-45-67890"
        />
        <button
          type="button"
          onClick={verify}
          disabled={busy || !value.trim()}
          className="h-10 px-3 inline-flex items-center gap-1 text-xs rounded-md bg-[#1a3d6b]/30 text-blue-300 border border-blue-500/30 hover:bg-[#1a3d6b]/50 disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          검증
        </button>
      </div>
      {status && (
        <div className={`mt-1.5 text-[11px] inline-flex items-center gap-1 ${
          status.ok ? 'text-green-400' : 'text-red-400'
        }`}>
          {status.ok ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          {status.label}
          {status.detail && <span className="text-gray-400 ml-1">({status.detail})</span>}
          {status.mock && status.ok && (
            <span className="ml-1 text-amber-400">⚠ API 키 미설정</span>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-gray-400">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
