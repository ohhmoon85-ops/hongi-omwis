'use client';

// ============================================================================
// 테마 토글 — Auto(시간 자동) / Light / Dark 3단계 사이클
// ----------------------------------------------------------------------------
// Auto: 매일 07:00~18:59 라이트, 19:00~06:59 다크 — 사용자 개입 없이 자동
// Light/Dark: 수동 강제, localStorage 지속화
// 페이지 열려 있는 상태에서 경계 시각 (07/19시) 도달 시 자동 갱신 (Auto 한정)
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Sun, Moon, SunMoon } from 'lucide-react';

type Mode = 'auto' | 'light' | 'dark';
const STORAGE_KEY = 'omwis-theme-mode';

// 현재 시각 기준 자동 테마 — KST 기준 (사용자 브라우저 로컬 시각 사용)
function autoTheme(): 'light' | 'dark' {
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? 'light' : 'dark';
}

function effectiveTheme(mode: Mode): 'light' | 'dark' {
  return mode === 'auto' ? autoTheme() : mode;
}

function applyTheme(mode: Mode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('omwis-light', effectiveTheme(mode) === 'light');
}

// 다음 테마 경계 (07시 또는 19시) 까지 ms 계산
function msUntilNextBoundary(): number {
  const now = new Date();
  const next = new Date(now);
  const h = now.getHours();
  if (h < 7)        next.setHours(7, 0, 0, 0);
  else if (h < 19)  next.setHours(19, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

interface Props {
  variant?: 'dark' | 'light';
  showLabel?: boolean;
}

export function ThemeToggle({ variant = 'dark', showLabel = false }: Props) {
  const [mode, setMode] = useState<Mode>('auto');

  // localStorage 에서 초기값 복원
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Mode | null;
    const initial: Mode = stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
    setMode(initial);
    applyTheme(initial);
  }, []);

  // Auto 모드일 때만: 경계 시각에 자동 갱신 + 탭 활성 시 재검사
  const reapply = useCallback(() => applyTheme(mode), [mode]);
  useEffect(() => {
    if (mode !== 'auto') return;
    // 다음 경계까지 setTimeout, 발화 시 재적용 + 다음 경계 예약
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      timer = setTimeout(() => {
        applyTheme('auto');
        schedule(); // 다음 경계 예약 (재귀)
      }, msUntilNextBoundary());
    }
    schedule();

    // 탭 다시 활성화 시 즉시 재검사 (절전 모드에서 깨어났을 때 대응)
    function onVisible() {
      if (document.visibilityState === 'visible') applyTheme('auto');
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mode, reapply]);

  function cycle() {
    const next: Mode = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // 현재 표시할 아이콘·툴팁
  const isLightActive = effectiveTheme(mode) === 'light';
  const icon =
    mode === 'auto' ? <SunMoon className="w-4 h-4" />
    : mode === 'light' ? <Sun className="w-4 h-4" />
    : <Moon className="w-4 h-4" />;
  const label =
    mode === 'auto' ? `자동 (현재 ${isLightActive ? '주간' : '야간'})`
    : mode === 'light' ? '주간 (수동)'
    : '야간 (수동)';

  // 클릭하면 어떻게 바뀌는지 안내
  const nextLabel =
    mode === 'auto' ? '주간 (수동)'
    : mode === 'light' ? '야간 (수동)'
    : '자동';

  const styles = variant === 'dark'
    ? 'text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.06]'
    : 'text-gray-600 hover:text-[#1a3d6b] hover:bg-[#1a3d6b]/[0.05] border border-[#1a3d6b]/15';

  return (
    <button
      onClick={cycle}
      title={`${label} · 클릭 → ${nextLabel}`}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm transition ${styles}`}
    >
      {icon}
      {showLabel && <span className="hidden lg:inline">{label}</span>}
    </button>
  );
}
