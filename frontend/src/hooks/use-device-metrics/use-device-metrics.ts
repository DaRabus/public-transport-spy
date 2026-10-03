'use client';

import useSWR from 'swr';
import type { DeviceMetricModel } from '@helpers/types';

const fetcher = async (url: string): Promise<DeviceMetricModel[]> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch device telemetry');
  }
  const json = (await response.json()) as { success: boolean; data: DeviceMetricModel[] };
  return json.data ?? [];
};

export const useDeviceMetrics = (deviceUuid: string | null, limit = 20) => {
  // Admins only (the BFF answers 403 for everyone else).
  const key = deviceUuid ? `/api/v1/admin/devices/${deviceUuid}/metrics?limit=${limit}` : null;

  const { data: metrics, isLoading: isMetricsLoading, error: metricsError } = useSWR(key, fetcher);

  return {
    metrics: metrics ?? [],
    isMetricsLoading,
    metricsError
  };
};
