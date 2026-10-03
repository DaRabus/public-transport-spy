import { NextRequest, NextResponse } from 'next/server';
import { createSession, deleteSession, verifySession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { clientIp, errorResponse } from '@helpers/utils';

export async function GET() {
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return NextResponse.json({ success: false, data: null }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/v1/auth/user/${encodeURIComponent(session.userId)}`, {
      headers: {
        'X-Api-Key': ADMIN_API_KEY
      },
      cache: 'no-store'
    });
    if (res.ok) {
      const user = await res.json();
      return NextResponse.json({
        success: true,
        data: user
      });
    }
  } catch (e) {
    console.error('Error fetching user from api:', e);
  }

  return NextResponse.json({
    success: true,
    data: {
      userName: session.userId,
      role: 'USER'
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userName, password } = await request.json();
    if (!userName || !password) {
      return errorResponse('Missing username or password', 400);
    }

    const ip = clientIp(request);
    const res = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ip && { 'X-Client-Ip': ip })
      },
      body: JSON.stringify({ userName, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return errorResponse(err.message || 'Invalid username or password', res.status);
    }

    const user = await res.json();
    await createSession(user.userName);

    return NextResponse.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    return errorResponse((error as Error).message || 'Login failed', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userName, password, inviteCode } = await request.json();
    if (!userName || !password) {
      return errorResponse('Missing username or password', 400);
    }

    const res = await fetch(`${API_BASE_URL}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, password, inviteCode })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return errorResponse(err.message || 'Registration failed', res.status);
    }

    const user = await res.json();
    await createSession(user.userName);

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    return errorResponse((error as Error).message || 'Registration failed', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return errorResponse('Unauthorized - Invalid session', 401);
  }

  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE_URL}/v1/auth/user/${encodeURIComponent(session.userId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': ADMIN_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return errorResponse(err.message || 'Failed to update user', res.status);
    }

    const updatedUser = await res.json();

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to update user', 500);
  }
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
