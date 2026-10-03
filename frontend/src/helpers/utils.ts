import { NextResponse } from 'next/server';

/**
 * The browser's IP for the API's login throttling, or `undefined` when it cannot be known safely.
 * Only with TRUST_PROXY (a reverse proxy sets X-Forwarded-For) is the last entry used: the one our own
 * proxy appended, which a client cannot forge. Without it the header is client-controlled, so it is
 * ignored and the API throttles on the BFF's address (one shared bucket for everyone).
 */
export function clientIp(request: Request): string | undefined {
  if (process.env.TRUST_PROXY !== 'true') return undefined;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  return forwarded || request.headers.get('x-real-ip') || undefined;
}

export const errorResponse = (message: string, status: number) =>
  NextResponse.json({ success: false, error: message }, { status, statusText: message });

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const d = new Date(dateString);
  return d.toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
