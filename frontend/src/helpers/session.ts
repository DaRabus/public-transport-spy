import 'server-only';
import { cookies } from 'next/headers';
import type { JWTPayload } from 'jose';
import { jwtVerify, SignJWT } from 'jose';
import { ADMIN_API_KEY, API_BASE_URL, COOKIE_KEYS } from '@helpers/constants';
import { randomUUID } from 'crypto';

// Resolved lazily so `next build` (NODE_ENV=production) works without runtime secrets.
function sessionKey() {
  const secret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'dev-session-secret-change-in-production-123456');
  if (secret.length < 32 || secret.startsWith('dev-session-secret')) {
    throw new Error(
      'SESSION_SECRET must be a unique secret of at least 32 characters (openssl rand -hex 32)'
    );
  }
  return new TextEncoder().encode(secret);
}

async function encrypt(payload: JWTPayload) {
  const jwtId = randomUUID();

  return new SignJWT({
    ...payload,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setJti(jwtId)
    .setSubject(payload.userId as string)
    .setAudience('public-transport-spy')
    .setIssuer('public-transport-spy-app')
    .sign(sessionKey());
}

async function decrypt(session: string | undefined = '') {
  if (!session) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(session, sessionKey(), {
      algorithms: ['HS256'],
      issuer: 'public-transport-spy-app',
      audience: 'public-transport-spy'
    });
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, expiresAt });
  const cookieStore = await cookies();

  // Secure cookies need HTTPS; COOKIE_SECURE=false allows a plain-HTTP LAN setup in production mode.
  const secureSetting = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN || undefined;

  cookieStore.set(COOKIE_KEYS.SESSION, session, {
    httpOnly: true,
    secure: secureSetting,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
    domain
  });

  cookieStore.set(COOKIE_KEYS.USER_ID, userId, {
    httpOnly: false,
    secure: secureSetting,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
    domain
  });
}

async function getSession() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_KEYS.SESSION)?.value;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const domain = process.env.COOKIE_DOMAIN || undefined;

  cookieStore.set(COOKIE_KEYS.SESSION, '', {
    httpOnly: true,
    expires: new Date(0),
    maxAge: 0,
    path: '/',
    domain
  });

  cookieStore.set(COOKIE_KEYS.USER_ID, '', {
    httpOnly: false,
    expires: new Date(0),
    maxAge: 0,
    path: '/',
    domain
  });
}

export async function verifySession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_KEYS.SESSION)?.value;

  if (!sessionCookie) {
    return { isAuth: false, userId: 'anonymous' };
  }

  const session = await decrypt(sessionCookie);

  if (!session?.userId || session.type !== 'access') {
    try {
      await deleteSession();
    } catch {
      // ignore
    }
    return { isAuth: false, userId: 'anonymous' };
  }

  return { isAuth: true, userId: session.userId as string };
}

/**
 * Admin check for BFF routes. The role is read from the API on every call (never trusted from the
 * cookie), so a role change applies immediately and a forged cookie can't claim admin rights.
 */
export async function verifyAdminSession(): Promise<{ isAdmin: boolean; userId: string }> {
  const session = await verifySession();
  if (!session.isAuth || session.userId === 'anonymous') {
    return { isAdmin: false, userId: 'anonymous' };
  }
  const res = await fetch(`${API_BASE_URL}/v1/auth/user/${encodeURIComponent(session.userId)}`, {
    headers: { 'X-Api-Key': ADMIN_API_KEY },
    cache: 'no-store'
  });
  if (!res.ok) {
    return { isAdmin: false, userId: session.userId };
  }
  const user = (await res.json()) as { role?: string };
  return { isAdmin: user.role === 'ADMIN', userId: session.userId };
}
