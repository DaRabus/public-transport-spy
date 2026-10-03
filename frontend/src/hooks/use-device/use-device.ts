'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { SWR_CACHE_KEYS } from '@helpers/constants';
import { fetchDevice } from '@helpers/api/fetch-device/fetch-device';
import type { FetchUpdateDeviceBody } from '@helpers/api/fetch-update-device/fetch-update-device';
import { fetchUpdateDevice } from '@helpers/api/fetch-update-device/fetch-update-device';
import { fetchUnpairDevice } from '@helpers/api/fetch-unpair-device/fetch-unpair-device';

export function useDevice(uuid: string) {
  const deviceKey = [SWR_CACHE_KEYS.DEVICES, uuid] as const;

  const {
    data: deviceData,
    error: deviceError,
    isLoading: isLoadingDevice,
    mutate: mutateDeviceData
  } = useSWR(uuid ? deviceKey : null, () => fetchDevice(uuid));

  const {
    trigger: mutateUpdateDevice,
    isMutating: isMutatingUpdateDevice,
    error: updateDeviceError
  } = useSWRMutation(deviceKey, (_, { arg }: { arg: Omit<FetchUpdateDeviceBody, 'uuid'> }) =>
    fetchUpdateDevice({ uuid, ...arg })
  );

  const {
    trigger: mutateUnpairDevice,
    isMutating: isMutatingUnpairDevice,
    error: unpairDeviceError
  } = useSWRMutation(deviceKey, () => fetchUnpairDevice({ uuid }));

  return {
    device: deviceData?.data ?? null,
    isLoadingDevice,
    deviceError,
    mutateDeviceData,

    mutateUpdateDevice,
    isMutatingUpdateDevice,
    updateDeviceError,

    mutateUnpairDevice,
    isMutatingUnpairDevice,
    unpairDeviceError
  };
}
