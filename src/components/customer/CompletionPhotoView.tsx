'use client';

import { useEffect, useState } from 'react';
import { getDeliveryPhotoUrl } from '@/lib/storage';

interface Props { path: string }

// 배송 완료 사진 — 표시 시점에 서명 URL 발급 (private 버킷)
export function CompletionPhotoView({ path }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getDeliveryPhotoUrl(path);
      if (!alive) return;
      if (u) setUrl(u);
      else setError(true);
    })();
    return () => { alive = false; };
  }, [path]);

  if (error) {
    return <div className="text-xs text-gray-500">사진을 불러올 수 없습니다.</div>;
  }
  if (!url) {
    return (
      <div className="h-40 bg-gray-100 rounded animate-pulse flex items-center justify-center text-xs text-gray-400">
        사진 불러오는 중...
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="배송 완료 사진"
        className="w-full max-h-96 rounded-lg object-contain bg-gray-50 hover:opacity-95 transition"
      />
      <p className="text-[10px] text-gray-500 text-center mt-1">
        클릭하면 원본 크기로 열립니다
      </p>
    </a>
  );
}
