import type { UserModel } from '@helpers/types';

export interface FetchRegisterUserBody {
  userName: string;
  password: string;
  inviteCode?: string;
}

export const fetchRegisterUser = async (callData: FetchRegisterUserBody) => {
  const response = await fetch('/api/v1/user', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(callData),
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Registration failed with error: ${response.statusText}`);
  }

  return (await response.json()) as {
    success: boolean;
    data: UserModel;
  };
};
