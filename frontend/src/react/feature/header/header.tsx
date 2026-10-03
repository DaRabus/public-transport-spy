import { verifySession } from '@helpers/session';
import { ClientHeader } from './client-header';

export async function Header() {
  const { userId, isAuth } = await verifySession();
  const userName = isAuth ? userId : null;

  return <ClientHeader userName={userName} isAuth={isAuth} />;
}
