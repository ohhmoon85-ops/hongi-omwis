// ============================================================================
// 이메일 발송 (Resend) — RESEND_API_KEY 미설정 시 콘솔 Mock 동작
// ============================================================================

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_EMAIL     = process.env.RESEND_FROM_EMAIL ?? 'noreply@hongi.co.kr';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  success: boolean;
  mock: boolean;
  messageId?: string;
  error?: string;
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendEmail(params: EmailParams): Promise<EmailSendResult> {
  if (!resend) {
    console.log('[EMAIL MOCK] →', params.to, params.subject);
    return { success: true, mock: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) throw error;
    return { success: true, mock: false, messageId: data?.id };
  } catch (err) {
    console.error('[EMAIL] send failed:', err);
    return {
      success: false,
      mock: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
