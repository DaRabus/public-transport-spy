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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const device = await getOwnedDevice(uuid, session.userId);
    if (!device) {
      return errorResponse('Device not found', 404);
    }

    return NextResponse.json({ success: true, data: device });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch device', 500);
  }
}

export async function PATCH(
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
    const res = await fetch(`${API_BASE_URL}/v1/devices/${encodeURIComponent(uuid)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': ADMIN_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return errorResponse(err.message || 'Failed to update device', res.status);
    }

    const updated = await res.json();
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to update device', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
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

    const res = await fetch(`${API_BASE_URL}/v1/devices/${encodeURIComponent(uuid)}/unpair`, {
      method: 'POST',
      headers: { 'X-Api-Key': ADMIN_API_KEY }
    });

    if (!res.ok) {
      return errorResponse('Failed to unpair device', res.status);
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to unpair device', 500);
  }
}
