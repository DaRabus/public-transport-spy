import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

/** Fetches the device and confirms it belongs to the given userId. Returns null if not found or not owned. */
async function getOwnedDevice(uuid: string, userId: string) {
  const res = await fetch(`${API_BASE_URL}/v1/devices/${encodeURIComponent(uuid)}`, {
    headers: { 'X-Api-Key': ADMIN_API_KEY },
    cache: 'no-store'
  });
  if (!res.ok) return null;
  const device = await res.json();
  return device.userId === userId ? device : null;
}

/** Transfers the session user's display to another account by username. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return errorResponse('Unauthorized', 401);
  }

  try {
    if (!(await getOwnedDevice(uuid, session.userId))) {
      return errorResponse('Device not found', 404);
    }
    const { toUserName } = (await request.json().catch(() => ({}))) as { toUserName?: string };
    const res = await fetch(`${API_BASE_URL}/v1/devices/${encodeURIComponent(uuid)}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': ADMIN_API_KEY },
      // The API checks the current owner again; it always comes from the session, never the browser.
      body: JSON.stringify({ toUserName: toUserName ?? '', fromUserName: session.userId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = Array.isArray(err.message) ? err.message.join('; ') : err.message;
      return errorResponse(message || 'Failed to transfer display', res.status);
    }
    return NextResponse.json({ success: true, data: await res.json() });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to transfer display', 500);
  }
}
