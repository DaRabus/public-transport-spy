import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@helpers/session';
import { ADMIN_API_KEY, API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

/**
 * Cancel the current user's pending pairing request (mistyped code, display never came online).
 * The owner always comes from the session; the API only deletes pending rows that belong to it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/v1/devices/pending/${encodeURIComponent(id)}?userId=${encodeURIComponent(session.userId)}`,
      { method: 'DELETE', headers: { 'X-Api-Key': ADMIN_API_KEY } }
    );
    if (!res.ok) {
      return errorResponse(
        res.status === 404 ? 'Pending pairing request not found' : 'Failed to cancel pairing',
        res.status
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to cancel pairing', 500);
  }
}
