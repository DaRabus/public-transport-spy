import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

/** Admins only: every device in the fleet (all owners), for the telemetry dashboard. */
export async function GET() {
  const { isAdmin } = await verifyAdminSession();
  if (!isAdmin) {
    return errorResponse('Admins only', 403);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/v1/devices`, {
      headers: { 'X-Api-Key': ADMIN_API_KEY },
      cache: 'no-store'
    });
    if (!res.ok) {
      return errorResponse('Failed to fetch devices', res.status);
    }
    return NextResponse.json({ success: true, data: await res.json() });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch devices', 500);
  }
}
