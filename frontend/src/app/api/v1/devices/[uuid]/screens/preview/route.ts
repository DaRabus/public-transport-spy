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

/** Live preview: composes the owner's unsaved display settings exactly like the device will receive them. */
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

    const body = await request.json();
    const res = await fetch(
      `${API_BASE_URL}/v1/devices/${encodeURIComponent(uuid)}/screens/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': ADMIN_API_KEY },
        body: JSON.stringify(body),
        cache: 'no-store'
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = Array.isArray(err.message) ? err.message.join('; ') : err.message;
      return errorResponse(message || 'Failed to compose preview', res.status);
    }

    return NextResponse.json({ success: true, data: await res.json() });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to compose preview', 500);
  }
}
