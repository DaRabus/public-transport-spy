import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@helpers/constants';
import { errorResponse } from '@helpers/utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query') || '';

  if (!query || query.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/v1/transit/stations?query=${encodeURIComponent(query)}&limit=10`,
      {
        cache: 'force-cache'
      }
    );

    if (!res.ok) {
      return errorResponse('Failed to fetch stations', res.status);
    }

    const stations = await res.json();
    return NextResponse.json({ success: true, data: stations });
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to search stations', 500);
  }
}
