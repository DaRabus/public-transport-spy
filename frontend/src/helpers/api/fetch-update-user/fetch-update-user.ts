import type { UserModel } from '@helpers/types';

/** Fields the API can change (password, social link, avatar). The user is taken from the session. */
export interface FetchUpdateUserBody {
  currentPassword?: string;
  newPassword?: string;
  socialUrl?: string | null;
  avatarUrl?: string | null;
}

export const fetchUpdateUser = async (callData: FetchUpdateUserBody) => {
  const response = await fetch('/api/v1/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(callData),
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Update failed with error: ${response.statusText}`);
  }

  return (await response.json()) as {
    success: boolean;
    message?: string;
    data: UserModel;
  };
};
