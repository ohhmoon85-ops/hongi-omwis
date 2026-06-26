// ============================================================================
// 알림 발송 이력 — 관리자 전용 (admin_all_notify RLS 적용)
// 모든 dispatchNotification 호출이 notifications 테이블에 audit 로 적재됨.
// ============================================================================

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';

interface NotificationRow {
  id: string;
  type: string;
  recipient_type: 'chairman' | 'admin' | 'customer' | null;
  channel: 'kakao' | 'email' | 'both' | null;
  message: string | null;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  created_at: string;
}

const EVENT_LABEL: Record<string, string> = {
  order_created:   '신규 주문',
  order_approved:  '주문 승인',
  order_rejected:  '주문 거절',
  delivery_depart: '배송 출발',
  delivery_done:   '배송 완료',
  stock_alert:     '안전재고 경보',
  acis_buy_signal: 'ACIS BUY 신호',
  credit_exceeded: '신용 한도 초과',
  weekly_summary:  '주간 요약',
};

const STATUS_COLOR = {
  sent:    'bg-green-500/15 text-green-300 border-green-500/30',
  failed:  'bg-red-500/15 text-red-300 border-red-500/30',
  pending: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

const CHANNEL_ICON: Record<string, string> = {
  kakao: '💬',
  email: '📧',
  both:  '💬📧',
};

const RECIPIENT_COLOR: Record<string, string> = {
  chairman: 'text-[#c8962e]',
  admin:    'text-blue-300',
  customer: 'text-purple-300',
};

export default async function NotificationsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as NotificationRow[];
  const sentCount   = rows.filter((r) => r.status === 'sent').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;
  const mockCount   = rows.filter((r) => r.message?.includes('(MOCK)')).length;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
          알림 발송 이력
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          (주)홍지
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          최근 200건 — 카카오 알림톡·이메일 발송 결과를 추적합니다 (Mock 포함)
        </p>
      </header>

      {/* 요약 4지표 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="전체"   value={String(rows.length)} sub="최근 200건" />
        <Stat label="성공"   value={String(sentCount)}   sub="발송 완료" color="text-green-300" />
        <Stat label="실패"   value={String(failedCount)} sub="재시도 필요" color="text-red-300" />
        <Stat label="Mock"  value={String(mockCount)}    sub="키 미설정 시" color="text-amber-300" />
      </div>

      {error ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
          조회 실패: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500 bg-[#171b26] border border-[#1f2433] rounded p-8 text-center">
          발송 이력이 아직 없습니다. 주문 접수·승인 등의 이벤트가 발생하면 자동으로 기록됩니다.
        </div>
      ) : (
        <div className="bg-[#171b26] border border-[#1f2433] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0f1117]">
              <tr className="text-xs text-gray-400">
                <th className="text-left py-2 px-3 font-normal w-32">시각</th>
                <th className="text-left py-2 px-3 font-normal w-16">채널</th>
                <th className="text-left py-2 px-3 font-normal w-32">이벤트</th>
                <th className="text-left py-2 px-3 font-normal w-24">수신자</th>
                <th className="text-left py-2 px-3 font-normal w-20">상태</th>
                <th className="text-left py-2 px-3 font-normal">메시지</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#1f2433] hover:bg-white/[0.02]">
                  <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-base">{CHANNEL_ICON[r.channel ?? ''] ?? '—'}</span>
                  </td>
                  <td className="py-2 px-3 text-gray-200">
                    {EVENT_LABEL[r.type] ?? r.type}
                  </td>
                  <td className={`py-2 px-3 text-xs ${RECIPIENT_COLOR[r.recipient_type ?? ''] ?? 'text-gray-500'}`}>
                    {r.recipient_type ?? '—'}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLOR[r.status]}`}>
                      {r.status === 'sent' ? '성공' : r.status === 'failed' ? '실패' : '대기'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-400 max-w-md truncate" title={r.message ?? ''}>
                    {r.message ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        💡 Mock 표시는 알리고/Resend 키가 미설정되어 실 발송 대신 콘솔에만 기록된 건.
        실 전송하려면 <Link href="/admin/dashboard" className="text-[#c8962e] hover:underline">대시보드</Link> 의 환경 설정 안내 참조.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-[#171b26] border border-[#1f2433] rounded-lg p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color ?? 'text-[#c8962e]'}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}
