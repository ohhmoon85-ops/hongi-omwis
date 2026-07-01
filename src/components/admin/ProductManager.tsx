'use client';

import { useEffect, useState } from 'react';
import {
  fetchAllProducts, updateProduct, setProductActive, addProduct,
} from '@/lib/products';
import { isDevMode, DEV_PRODUCTS } from '@/lib/dev-data';
import { formatKRW } from '@/lib/utils';
import { PRODUCT_TYPE_LABEL, type Product, type ProductType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Pencil, Plus, PackagePlus, ChevronDown, ChevronRight } from 'lucide-react';

const TYPE_BADGE: Record<ProductType, string> = {
  raw:   'bg-slate-500/20 text-slate-300',
  oil:   'bg-amber-500/20 text-amber-300',
  water: 'bg-blue-500/20 text-blue-300',
};

// 트리 그룹 순서 (종류)
const TYPE_ORDER: ProductType[] = ['raw', 'oil', 'water'];
const TYPE_ICON: Record<ProductType, string> = { raw: '🪙', oil: '🛢️', water: '💧' };

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<ProductType>>(new Set());

  function toggleGroup(t: ProductType) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  async function refresh() {
    if (isDevMode) { setProducts(DEV_PRODUCTS); setLoaded(true); return; }
    try {
      setProducts(await fetchAllProducts());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '품목 조회 실패');
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <>
      <Toaster position="top-center" />
      <datalist id="purity-options">
        <option value="99.3% 합금" />
        <option value="99.99% 순알" />
      </datalist>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">기본 단가는 거래처 협상가가 없을 때 적용됩니다</div>
        <button onClick={refresh} className="p-2 text-gray-400 hover:text-white" aria-label="새로고침">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!loaded ? (
        <div className="text-sm text-gray-500">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          <AddProductForm onDone={refresh} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">품목 목록 (종류별)</h2>
            {products.length === 0 ? (
              <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06]">
                <CardContent className="py-8 text-center text-sm text-gray-500">
                  등록된 품목이 없습니다. 위에서 추가하세요.
                </CardContent>
              </Card>
            ) : (
              TYPE_ORDER.map((t) => {
                const group = products.filter((p) => p.type === t);
                if (group.length === 0) return null;
                const activeN = group.filter((p) => p.is_active).length;
                const open = !collapsed.has(t);
                return (
                  <div key={t} className="rounded-xl border border-white/[0.06] overflow-hidden">
                    {/* 종류 헤더 (트리 루트) */}
                    <button
                      onClick={() => toggleGroup(t)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-gradient-to-b from-[#181c28] to-[#13161f] hover:from-[#1c2130] text-left"
                    >
                      {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <span className="text-base">{TYPE_ICON[t]}</span>
                      <span className="font-semibold text-white">{PRODUCT_TYPE_LABEL[t]}</span>
                      <span className="text-xs text-gray-500">
                        {group.length}개 품목 · 판매중 {activeN}
                      </span>
                    </button>
                    {/* 하위 세부 품목 */}
                    {open && (
                      <div className="p-2 pl-4 sm:pl-6 space-y-2 bg-black/20 border-t border-white/[0.06]">
                        {group.map((p) => <ProductRow key={p.id} product={p} onSaved={refresh} />)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </div>
      )}
    </>
  );
}

function ProductRow({ product: p, onSaved }: { product: Product; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // 전체 편집 폼 상태
  const [name, setName] = useState(p.name);
  const [type, setType] = useState<ProductType>(p.type);
  const [price, setPrice] = useState(String(p.base_price ?? 0));
  const [unit, setUnit] = useState(p.unit);
  const [thickness, setThickness] = useState(p.thickness != null ? String(p.thickness) : '');
  const [width, setWidth] = useState(p.width != null ? String(p.width) : '');
  const [purity, setPurity] = useState(p.purity ?? '');

  function resetForm() {
    setName(p.name); setType(p.type); setPrice(String(p.base_price ?? 0));
    setUnit(p.unit); setThickness(p.thickness != null ? String(p.thickness) : '');
    setWidth(p.width != null ? String(p.width) : '');
    setPurity(p.purity ?? '');
  }

  async function save() {
    if (!name.trim()) { toast.error('품목명을 입력하세요'); return; }
    const n = parseInt(price, 10);
    if (isNaN(n) || n < 0) { toast.error('단가를 확인하세요'); return; }
    setSaving(true);
    try {
      await updateProduct(p.id, {
        name: name.trim(),
        type,
        base_price: n,
        unit: unit || 'kg',
        thickness: thickness ? parseFloat(thickness) : null,
        width: width ? parseInt(width, 10) : null,
        purity: purity.trim() || null,
      });
      toast.success(`${name.trim()} 저장`);
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    try {
      await setProductActive(p.id, !p.is_active);
      toast.success(p.is_active ? '판매 중지' : '판매 재개');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '변경 실패');
    }
  }

  return (
    <Card className={`bg-gradient-to-b from-[#181c28] to-[#13161f] ${p.is_active ? 'border-white/[0.06]' : 'border-white/[0.03] opacity-60'} text-white`}>
      <CardContent className="py-3">
        {editing ? (
          /* ── 전체 편집 폼 ── */
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] text-gray-400">품목명</label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">종류</label>
                <select value={type} onChange={(e) => setType(e.target.value as ProductType)}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm">
                  <option value="raw">생 알루미늄</option>
                  <option value="oil">지용성</option>
                  <option value="water">수용성</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-400">기본 단가 (원)</label>
                <Input type="number" inputMode="numeric" value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">단위</label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)}
                  className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-gray-400">순도</label>
                <Input value={purity} onChange={(e) => setPurity(e.target.value)}
                  list="purity-options" placeholder="예: 99.3% 합금"
                  className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-400">두께(mm)</label>
                  <Input type="number" inputMode="decimal" value={thickness}
                    onChange={(e) => setThickness(e.target.value)} placeholder="선택"
                    className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400">폭(mm)</label>
                  <Input type="number" inputMode="numeric" value={width}
                    onChange={(e) => setWidth(e.target.value)} placeholder="선택"
                    className="bg-[#0f1117] border-[#2a2f3e] text-white h-9 mt-1" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="h-9 bg-[#1a3d6b] hover:bg-[#235490] text-white">
                {saving ? '저장 중...' : '저장'}
              </Button>
              <Button onClick={() => { setEditing(false); resetForm(); }} variant="outline" className="h-9">
                취소
              </Button>
            </div>
          </div>
        ) : (
          /* ── 표시 ── */
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] px-2 py-0.5 rounded ${TYPE_BADGE[p.type]}`}>
                  {PRODUCT_TYPE_LABEL[p.type]}
                </span>
                <span className="text-sm font-semibold">{p.name}</span>
                {!p.is_active && <span className="text-[11px] text-gray-500">판매중지</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1 space-x-2">
                {p.thickness != null && <span>두께 {p.thickness}mm</span>}
                {p.purity && <span>· 순도 {p.purity}</span>}
                {p.width != null && <span>· 폭 {p.width}mm</span>}
                <span>· 단위 {p.unit}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[11px] text-gray-500">기본 단가</div>
                <div className="text-lg font-bold text-[#c8962e]">{formatKRW(p.base_price)}</div>
              </div>
              <button onClick={() => { resetForm(); setEditing(true); }} className="p-2 text-gray-400 hover:text-white" title="품목 수정">
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={toggleActive}
                className={`text-xs px-2 py-1 rounded border ${p.is_active ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}
              >
                {p.is_active ? '판매 중지' : '판매 재개'}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddProductForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProductType>('raw');
  const [basePrice, setBasePrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [thickness, setThickness] = useState('');
  const [width, setWidth] = useState('');
  const [purity, setPurity] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { toast.error('품목명을 입력하세요'); return; }
    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price < 0) { toast.error('기본 단가를 확인하세요'); return; }
    setSaving(true);
    try {
      await addProduct({
        name: name.trim(), type, base_price: price, unit: unit || 'kg',
        thickness: thickness ? parseFloat(thickness) : null,
        width: width ? parseInt(width, 10) : null,
        purity: purity.trim() || null,
      });
      toast.success('품목 추가 완료');
      setName(''); setBasePrice(''); setThickness(''); setWidth(''); setPurity('');
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '추가 실패');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
        <PackagePlus className="w-4 h-4 mr-1" /> 품목 추가
      </Button>
    );
  }

  return (
    <Card className="bg-gradient-to-b from-[#181c28] to-[#13161f] border-white/[0.06] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-gray-200">품목 추가</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400">품목명</label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 생 알루미늄 0.5mm × 1000mm"
              className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-400">종류</label>
            <select value={type} onChange={(e) => setType(e.target.value as ProductType)}
              className="mt-1 w-full h-10 px-3 rounded-md border border-[#2a2f3e] bg-[#0f1117] text-white text-sm">
              <option value="raw">생 알루미늄</option>
              <option value="oil">지용성</option>
              <option value="water">수용성</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">기본 단가 (원)</label>
            <Input type="number" inputMode="numeric" value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)} placeholder="4500"
              className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-400">단위</label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg"
              className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-400">순도</label>
            <Input value={purity} onChange={(e) => setPurity(e.target.value)}
              list="purity-options" placeholder="예: 99.3% 합금"
              className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">두께(mm)</label>
              <Input type="number" inputMode="decimal" value={thickness}
                onChange={(e) => setThickness(e.target.value)} placeholder="선택"
                className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-400">폭(mm)</label>
              <Input type="number" inputMode="numeric" value={width}
                onChange={(e) => setWidth(e.target.value)} placeholder="선택"
                className="bg-[#0f1117] border-[#2a2f3e] text-white mt-1" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="w-4 h-4 mr-1" />{saving ? '추가 중...' : '추가'}
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline">취소</Button>
        </div>
      </CardContent>
    </Card>
  );
}
