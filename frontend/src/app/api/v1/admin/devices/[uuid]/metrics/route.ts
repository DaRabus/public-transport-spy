import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

/** Admins only: telemetry history of one device (newest first). `?limit=` is clamped to 1-500. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const { isAdmin } = await verifyAdminSession();
  if (!isAdmin) {
    return errorResponse('Admins only', 403);
  }

  const requested = Number(request.nextUrl.searchParams.get('limit') ?? 144);
  const limit = Math.min(
    500,
    Math.max(1, Number.isFinite(requested) ? Math.round(requested) : 144)
  );

  try {
    const res = await fetch(
      `${API_BASE_URL}/v1/devices/${encodeURIComponent(uuid)}/metrics?limit=${limit}`,
      {
        headers: { 'X-Api-Key': ADMIN_API_KEY },
        cache: 'no-store'
      }
    );
    if (!res.ok) {
      return errorResponse('Failed to fetch device telemetry', res.status);
    }
    return NextResponse.json({ success: true, data: await res.json() });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch device telemetry', 500);
  }
}
