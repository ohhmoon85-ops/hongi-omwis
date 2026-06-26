'use client';

// ============================================================================
// 주간/야간 테마 토글 — localStorage 지속, FOUC 방지는 layout.tsx 의 inline script
// ============================================================================

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'omwis-theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('omwis-light', theme === 'light');
}

interface Props {
  variant?: 'dark' | 'light';
  showLabel?: boolean;
}

export function ThemeToggle({ variant = 'dark', showLabel = false }: Props) {
  // SSR 시점에는 dark 고정 → mount 후 localStorage 값으로 정정
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    }
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const styles = variant === 'dark'
    ? 'text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.06]'
    : 'text-gray-600 hover:text-[#1a3d6b] hover:bg-[#1a3d6b]/[0.05] border border-[#1a3d6b]/15';

  const label = theme === 'dark' ? '주간 모드' : '야간 모드';

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm transition ${styles}`}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
