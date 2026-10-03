'use client';

import useSWR, { useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import { SWR_CACHE_KEYS } from '@helpers/constants';
import type { FetchRegisterUserBody } from '@helpers/api/fetch-register-user/fetch-register-user';
import { fetchRegisterUser } from '@helpers/api/fetch-register-user/fetch-register-user';
import type { FetchLoginUserBody } from '@helpers/api/fetch-login-user/fetch-login-user';
import { fetchLoginUser } from '@helpers/api/fetch-login-user/fetch-login-user';
import type { FetchUpdateUserBody } from '@helpers/api/fetch-update-user/fetch-update-user';
import { fetchUpdateUser } from '@helpers/api/fetch-update-user/fetch-update-user';
import type { UserModel, UserRole } from '@helpers/types';

export const useUser = () => {
  const { mutate } = useSWRConfig();
  const userKey = SWR_CACHE_KEYS.USER;

  const {
    data: userData,
    isLoading: isUserDataLoading,
    error: userError,
    mutate: mutateUserLogin
  } = useSWR(userKey, async () => {
    const response = await fetch('/api/v1/user', {
      credentials: 'include',
      method: 'GET'
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      success: boolean;
      data: UserModel;
    };

    if (!json.data) {
      return null;
    }

    return {
      isLoggedIn: true,
      id: json.data.id,
      avatarUrl: json.data.avatarUrl ?? null,
      userName: json.data.userName,
      socialUrl: json.data.socialUrl ?? null,
      role: json.data.role as UserRole,
      createdAt: json.data.createdAt,
      updatedAt: json.data.updatedAt
    };
  });

  const {
    trigger: mutateRegisterUser,
    isMutating: isMutatingRegisterUser,
    data: registeredUserData,
    error: registerUserError
  } = useSWRMutation(
    userKey,
    (_: string, { arg }: { arg: FetchRegisterUserBody }) => fetchRegisterUser(arg),
    { throwOnError: false }
  );

  const {
    trigger: mutateLoginUser,
    isMutating: isMutatingLoginUser,
    error: loginUserError
  } = useSWRMutation(userKey, async (url, { arg }: { arg: FetchLoginUserBody }) => {
    const data = await fetchLoginUser(arg);
    await mutate(
      userKey,
      {
        isLoggedIn: true,
        id: data.data.id,
        avatarUrl: data.data.avatarUrl || null,
        socialUrl: data.data.socialUrl || null,
        userName: data.data.userName,
        role: data.data.role,
        createdAt: data.data.createdAt,
        updatedAt: data.data.updatedAt
      },
      { revalidate: false }
    );
    return data;
  });

  const {
    trigger: mutateLogoutUser,
    isMutating: isMutatingLogoutUser,
    error: logoutUserError
  } = useSWRMutation('/api/v1/user', () =>
    fetch('/api/v1/user', { method: 'DELETE', credentials: 'include' })
  );

  const {
    trigger: mutateUpdateUser,
    isMutating: isMutatingUpdateUser,
    error: updateUserError
  } = useSWRMutation(userKey, async (url, { arg }: { arg: FetchUpdateUserBody }) => {
    const data = await fetchUpdateUser(arg);
    await mutate(
      userKey,
      {
        isLoggedIn: true,
        id: data.data.id,
        avatarUrl: data.data.avatarUrl ?? null,
        socialUrl: data.data.socialUrl ?? null,
        userName: data.data.userName,
        role: data.data.role,
        createdAt: data.data.createdAt,
        updatedAt: data.data.updatedAt
      },
      { revalidate: false }
    );
    return data;
  });

  return {
    userData,
    isUserDataLoading,
    userError,
    mutateRegisterUser,
    registeredUserData,
    isMutatingRegisterUser,
    registerUserError,
    mutateUserLogin,
    mutateLoginUser,
    isMutatingLoginUser,
    loginUserError,
    mutateLogoutUser,
    isMutatingLogoutUser,
    logoutUserError,
    mutateUpdateUser,
    isMutatingUpdateUser,
    updateUserError
  };
};
