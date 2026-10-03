import type { UserModel } from '@helpers/types';

export interface FetchLoginUserBody {
  userName: string;
  password: string;
}

export const fetchLoginUser = async (callData: FetchLoginUserBody) => {
  const response = await fetch('/api/v1/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(callData),
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Login failed with error: ${response.statusText}`);
  }

  return (await response.json()) as {
    success: boolean;
    data: UserModel;
  };
};
