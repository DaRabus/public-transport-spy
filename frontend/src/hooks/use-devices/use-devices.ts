'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { SWR_CACHE_KEYS } from '@helpers/constants';
import { fetchDevices } from '@helpers/api/fetch-devices/fetch-devices';
import type { FetchPairDeviceBody } from '@helpers/api/fetch-pair-device/fetch-pair-device';
import { fetchPairDevice } from '@helpers/api/fetch-pair-device/fetch-pair-device';

export function useDevices(options: { refreshInterval?: number } = {}) {
  const {
    data: devicesData,
    error: devicesError,
    isLoading: isLoadingDevices,
    mutate: mutateDevicesList
  } = useSWR(SWR_CACHE_KEYS.DEVICES, fetchDevices, {
    refreshInterval: options.refreshInterval ?? 0
  });

  const {
    trigger: mutatePairDevice,
    isMutating: isMutatingPairDevice,
    error: pairDeviceError
  } = useSWRMutation(SWR_CACHE_KEYS.DEVICES, (_: string, { arg }: { arg: FetchPairDeviceBody }) =>
    fetchPairDevice(arg)
  );

  return {
    devices: devicesData?.data ?? [],
    isLoadingDevices,
    devicesError,
    mutateDevicesList,

    mutatePairDevice,
    isMutatingPairDevice,
    pairDeviceError
  };
}
