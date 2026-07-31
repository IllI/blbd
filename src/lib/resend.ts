import 'server-only';
import { Resend } from 'resend';
import { requireEnv } from '@/lib/env';
import { escapeHtml } from '@/lib/utils';

export { escapeHtml };

let cached: Resend | null = null;

export function getResend(): Resend {
  if (!cached) cached = new Resend(requireEnv('RESEND_API_KEY'));
  return cached;
}

export function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'BLBD <contact@blbd.life>';
}

/** Shared shell so every BLBD email looks like the site. */
export function emailShell(bodyHtml: string, preheader = ''): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f8fa;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e8ed;overflow:hidden;">
        <tr><td style="background:#28264d;padding:24px 32px;">
          <div style="font:700 20px/1.2 'Inter',Helvetica,Arial,sans-serif;color:#ffffff;letter-spacing:-0.01em;">Better Living Better Dying</div>
          <div style="font:400 13px/1.4 'Inter',Helvetica,Arial,sans-serif;color:#9bdaf2;margin-top:4px;">✹ ✦ ✹</div>
        </td></tr>
        <tr><td style="padding:32px;font:400 16px/1.6 'Inter',Helvetica,Arial,sans-serif;color:#28264d;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e4e8ed;font:400 13px/1.5 'Inter',Helvetica,Arial,sans-serif;color:#69778c;">
          Better Living Better Dying · <a href="https://blbd.life" style="color:#48468c;">blbd.life</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
