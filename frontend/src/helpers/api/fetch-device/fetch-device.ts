import type { DeviceModel } from '@helpers/types';

export const fetchDevice = async (
  uuid: string
): Promise<{ success: boolean; data: DeviceModel }> => {
  const response = await fetch(`/api/v1/devices/${encodeURIComponent(uuid)}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch device: ${response.statusText}`);
  }

  return response.json();
};
