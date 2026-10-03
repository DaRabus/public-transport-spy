import { NextResponse } from 'next/server';
import { verifySession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

/** Supported device time zones (IANA names) for the settings picker. */
export async function GET() {
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/v1/devices/timezones`, {
      headers: { 'X-Api-Key': ADMIN_API_KEY },
      next: { revalidate: 3600 }
    });
    if (!res.ok) {
      return errorResponse('Failed to fetch time zones', res.status);
    }
    return NextResponse.json({ success: true, data: await res.json() });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch time zones', 500);
  }
}
