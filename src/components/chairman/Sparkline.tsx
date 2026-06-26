// 의존성 없는 SVG 미니 라인 차트 — 회장 위젯 sparkline 용
// (recharts 무거우므로 작은 시각화는 inline SVG 가 깔끔)

interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  data, color = '#c8962e', width = 100, height = 40,
}: Props) {
  if (data.length < 2) {
    return <div className="text-[9px] text-gray-600">데이터 부족</div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // 마지막 점에 dot
  const lastIdx = data.length - 1;
  const lastX = width;
  const lastY = height - ((data[lastIdx] - min) / range) * height;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
