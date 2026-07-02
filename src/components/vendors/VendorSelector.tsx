'use client';

// ============================================================================
// VendorSelector — 후보 업체 선택 또는 즉시 등록
// VendorSampleWizard STEP 0 에서 사용.
// ============================================================================

import { useEffect, useState } from 'react';
import { loadDevVendors, createDevVendor } from '@/lib/dev-vendors';
import { fetchCandidateVendors, createCandidateVendor } from '@/lib/vendors';
import { isDevMode } from '@/lib/dev-data';
import { formatDate } from '@/lib/utils';
import type { CandidateVendor } from '@/types';
import { VENDOR_STATUS_BADGE } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Building2 } from 'lucide-react';

interface Props {
  value: CandidateVendor | null;
  onSelect: (v: CandidateVendor) => void;
}

export function VendorSelector({ value, onSelect }: Props) {
  const [vendors, setVendors] = useState<CandidateVendor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function refresh() {
    try {
      const list = isDevMode ? loadDevVendors() : await fetchCandidateVendors();
      // approved 도 재평가 가능하도록 전부 노출 (rejected 만 제외)
      setVendors(list.filter((v) => v.status !== 'rejected'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업체 조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-3">
      {/* 기존 업체 목록 */}
      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : vendors.length === 0 ? (
        <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
          <CardContent className="py-6 text-center text-sm text-gray-500">
            등록된 후보 업체가 없습니다. 아래에서 새 업체를 등록하세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {vendors.map((v) => {
            const badge = VENDOR_STATUS_BADGE[v.status];
            const selected = value?.id === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                type="button"
                className={`p-3 rounded-lg border text-left transition ${
                  selected
                    ? 'border-[#c8962e] bg-[#c8962e]/10 ring-2 ring-[#c8962e]/40'
                    : 'border-white/[0.06] bg-gradient-to-b from-[#181c28] to-[#13161f] hover:border-[#1a3d6b]'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-semibold text-white">{v.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
                {v.location && (
                  <div className="text-[11px] text-gray-400 mt-0.5">{v.location}</div>
                )}
                <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-2">
                  {v.price_note && <span>💰 {v.price_note}</span>}
                  {v.moq && <span>MOQ {v.moq}</span>}
                  {v.lead_time && <span>납기 {v.lead_time}</span>}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  등록 {formatDate(v.created_at)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="bg-green-600 hover:bg-green-700 text-white flex-1"
        >
          <Plus className="w-4 h-4 mr-1" /> {showNew ? '새 업체 등록 취소' : '새 업체 등록'}
        </Button>
        <button
          type="button"
          onClick={refresh}
          className="p-2 text-gray-400 hover:text-white border border-[#2a2f3e] rounded"
          aria-label="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {showNew && (
        <VendorInlineForm
          onCreated={(v) => {
            setShowNew(false);
            refresh();
            onSelect(v);
          }}
        />
      )}
    </div>
  );
}

// ─── 인라인 즉시 등록 폼 ─────────────────────────────────────────────────
function VendorInlineForm({ onCreated }: { onCreated: (v: CandidateVendor) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', location: '', contact_name: '', wechat: '',
    price_note: '', moq: '', lead_time: '', payment_terms: '',
    factory_note: '',
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit() {
    if (!form.name.trim()) { toast.error('업체명은 필수입니다'); return; }
    setSaving(true);
    try {
      let vendor: CandidateVendor;
      if (isDevMode) {
        vendor = createDevVendor(form);
      } else {
        const created = await createCandidateVendor(form);
        vendor = {
          id: created.id, name: created.name, location: created.location,
          contact_name: created.contact_name, wechat: created.wechat,
          phone: created.phone, email: created.email,
          price_note: created.price_note, moq: created.moq,
          lead_time: created.lead_time, payment_terms: created.payment_terms,
          factory_note: created.factory_note, status: created.status,
          approved_at: created.approved_at, memo: created.memo,
          created_at: created.created_at, updated_at: created.updated_at,
        };
      }
      toast.success(`${form.name} 등록됨`);
      onCreated(vendor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '등록 실패');
    } finally { setSaving(false); }
  }

  return (
    <Card className="bg-gradient-to-b from-purple-900/20 to-[#13161f] border-purple-500/30">
      <CardContent className="py-4 space-y-3">
        <div className="text-xs font-semibold text-purple-300 mb-1">
          새 후보 업체 즉시 등록
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="업체명 *" value={form.name} onChange={(v) => set('name', v)} placeholder="예: 佛山XX铝业" />
          <Field label="소재지" value={form.location} onChange={(v) => set('location', v)} placeholder="예: 광둥성 포산" />
          <Field label="담당자" value={form.contact_name} onChange={(v) => set('contact_name', v)} />
          <Field label="WeChat / 전화" value={form.wechat} onChange={(v) => set('wechat', v)} placeholder="WeChat ID" />
          <Field label="단가" value={form.price_note} onChange={(v) => set('price_note', v)} placeholder="USD 2,450/t" />
          <Field label="MOQ" value={form.moq} onChange={(v) => set('moq', v)} placeholder="5t" />
          <Field label="납기" value={form.lead_time} onChange={(v) => set('lead_time', v)} placeholder="30일" />
          <Field label="결제 조건" value={form.payment_terms} onChange={(v) => set('payment_terms', v)} placeholder="T/T 30/70" />
        </div>
        <div>
          <Label className="text-xs text-gray-400">공장 정보 (규모·설비·인증)</Label>
          <textarea
            value={form.factory_note}
            onChange={(e) => set('factory_note', e.target.value)}
            rows={2}
            className="mt-1 w-full px-3 py-2 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm resize-none"
            placeholder="예: 압연 라인 3개, ISO 9001 인증"
          />
        </div>
        <Button onClick={submit} disabled={saving} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
          {saving ? '등록 중...' : '등록 + 선택'}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-gray-400">{label}</Label>
      <Input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1"
      />
    </div>
  );
}
