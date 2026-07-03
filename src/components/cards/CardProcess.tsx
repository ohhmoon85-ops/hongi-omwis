'use client';

// ============================================================================
// 명함 1장 처리 — 사진 + 입력 폼 + (선택)AI 읽기 → [업체로 등록] / [버림] / [다음]
// AI 는 사람이 [업체로 등록]을 눌러야 저장되는 "제안"일 뿐 (원칙 ③).
// ============================================================================

import { useState } from 'react';
import { isDevMode } from '@/lib/dev-data';
import { createCandidateVendor } from '@/lib/vendors';
import { createDevVendor } from '@/lib/dev-vendors';
import { linkCardToVendor, discardCard, restoreCard, ocrCard } from '@/lib/cards';
import type { BusinessCard, CardOcrResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import { Sparkles, Loader2, Trash2, ChevronRight, Building2, RotateCcw } from 'lucide-react';

interface Props {
  card: BusinessCard;
  ocrEnabled: boolean;
  onDone: () => void;   // 등록/버림 후 다음으로
  onSkip: () => void;   // 그냥 다음
}

export function CardProcess({ card, ocrEnabled, onDone, onSkip }: Props) {
  const [company, setCompany] = useState(card.ocr_result?.company ?? '');
  const [contact, setContact] = useState(card.ocr_result?.contact_name ?? '');
  const [title, setTitle] = useState(card.ocr_result?.title ?? '');
  const [phone, setPhone] = useState(card.ocr_result?.phone ?? '');
  const [wechat, setWechat] = useState(card.ocr_result?.wechat ?? '');
  const [email, setEmail] = useState(card.ocr_result?.email ?? '');
  const [address, setAddress] = useState(card.ocr_result?.address ?? '');
  const [memo, setMemo] = useState(card.quick_memo ?? '');
  const [saving, setSaving] = useState(false);
  const [ocring, setOcring] = useState(false);

  function applyOcr(r: CardOcrResult) {
    if (r.company) setCompany(r.company);
    if (r.contact_name) setContact(r.contact_name);
    if (r.title) setTitle(r.title);
    if (r.phone) setPhone(r.phone);
    if (r.wechat) setWechat(r.wechat);
    if (r.email) setEmail(r.email);
    if (r.address) setAddress(r.address);
  }

  async function runOcr() {
    if (!card.photo_url) { toast.error('사진을 불러올 수 없습니다'); return; }
    setOcring(true);
    try {
      const base64 = await toDataUrl(card.photo_url);
      const r = await ocrCard(card.id, base64);
      applyOcr(r);
      toast.success('AI가 읽어왔어요 — 확인 후 등록하세요');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI 인식 실패');
    } finally {
      setOcring(false);
    }
  }

  async function register() {
    if (!company.trim()) { toast.error('업체명을 입력하세요'); return; }
    setSaving(true);
    try {
      const input = {
        name: company.trim(),
        location: address.trim() || undefined,
        contact_name: contact.trim() || undefined,
        wechat: wechat.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        factory_note: [title.trim(), memo.trim()].filter(Boolean).join(' · ') || undefined,
      };
      const vendorId = isDevMode
        ? createDevVendor(input).id
        : (await createCandidateVendor(input)).id;
      await linkCardToVendor(card.id, vendorId);
      toast.success(`${company.trim()} 업체로 등록`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    try {
      await discardCard(card.id);
      toast.success('버림 처리 (복구 가능)');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '실패');
    }
  }

  async function restore() {
    try {
      await restoreCard(card.id);
      toast.success('되살렸습니다');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '실패');
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 명함 사진 */}
      <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black/30 flex items-center justify-center min-h-[220px]">
        {card.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photo_url} alt="명함" className="w-full h-auto object-contain max-h-[420px]" />
        ) : (
          <div className="text-sm text-gray-500 py-16">사진 없음</div>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="space-y-2.5">
        {ocrEnabled && (
          <Button
            onClick={runOcr}
            disabled={ocring}
            className="w-full h-10 bg-[#2b2140] hover:bg-[#3a2c56] text-purple-200 border border-purple-500/30"
          >
            {ocring ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {ocring ? '읽는 중…' : 'AI로 읽기 (선택)'}
          </Button>
        )}

        <Field label="업체명 *" value={company} onChange={setCompany} placeholder="회사명(중문 가능)" />
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="담당자" value={contact} onChange={setContact} />
          <Field label="직함" value={title} onChange={setTitle} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="전화" value={phone} onChange={setPhone} />
          <Field label="WeChat" value={wechat} onChange={setWechat} />
        </div>
        <Field label="이메일" value={email} onChange={setEmail} />
        <Field label="주소/소재지" value={address} onChange={setAddress} />
        <Field label="메모" value={memo} onChange={setMemo} placeholder="현장 메모" />

        <div className="flex flex-wrap gap-2 pt-1">
          {card.status === 'discarded' ? (
            <Button onClick={restore} className="h-10 bg-[#1a3d6b] hover:bg-[#235490] text-white">
              <RotateCcw className="w-4 h-4 mr-1.5" /> 되살리기
            </Button>
          ) : (
            <Button onClick={register} disabled={saving} className="h-10 bg-green-600 hover:bg-green-700 text-white">
              <Building2 className="w-4 h-4 mr-1.5" />{saving ? '등록 중…' : '업체로 등록'}
            </Button>
          )}
          {card.status !== 'discarded' && (
            <Button onClick={discard} variant="outline" className="h-10 border-red-500/40 text-red-300 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 mr-1.5" /> 버림
            </Button>
          )}
          <Button onClick={onSkip} variant="outline" className="h-10 ml-auto">
            다음 <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-gray-400">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-0.5"
      />
    </div>
  );
}

/** 서명 URL / dataURL → dataURL(base64) 로 변환 (AI 전송용) */
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('이미지 로드 실패'));
    r.readAsDataURL(blob);
  });
}
