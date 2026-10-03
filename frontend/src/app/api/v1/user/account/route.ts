import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, verifySession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

/** Deletes the session user's account (password required) and logs out. Their displays are released. */
export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { currentPassword } = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
    };
    const res = await fetch(`${API_BASE_URL}/v1/auth/user/${encodeURIComponent(session.userId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': ADMIN_API_KEY },
      body: JSON.stringify({ currentPassword: currentPassword ?? '' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = Array.isArray(err.message) ? err.message.join('; ') : err.message;
      return errorResponse(message || 'Failed to delete account', res.status);
    }
    const result = await res.json();
    await deleteSession();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to delete account', 500);
  }
}
