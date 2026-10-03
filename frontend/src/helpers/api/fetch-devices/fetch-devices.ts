import type { DeviceModel } from '@helpers/types';

export const fetchDevices = async (): Promise<{ success: boolean; data: DeviceModel[] }> => {
  const response = await fetch('/api/v1/devices', { credentials: 'include' });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch devices: ${response.statusText}`);
  }

  return response.json();
};
