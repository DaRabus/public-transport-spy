import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

export async function GET() {
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return NextResponse.json({ success: false, data: [] }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/v1/devices?userId=${encodeURIComponent(session.userId)}`,
      {
        headers: {
          'X-Api-Key': ADMIN_API_KEY
        },
        cache: 'no-store'
      }
    );

    if (!res.ok) {
      return errorResponse('Failed to fetch devices from backend', res.status);
    }

    const devices = await res.json();
    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch devices', 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return errorResponse('Your session has expired. Please log in again to pair a device.', 401);
  }
  const currentUserId = session.userId;

  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE_URL}/v1/devices/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': ADMIN_API_KEY
      },
      body: JSON.stringify({
        ...body,
        userId: currentUserId
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return errorResponse(err.message || 'Pairing failed', res.status);
    }

    const device = await res.json();
    return NextResponse.json({ success: true, data: device }, { status: 200 });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to pair device', 500);
  }
}
