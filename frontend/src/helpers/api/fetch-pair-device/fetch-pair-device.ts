import type { DeviceModel } from '@helpers/types';

export interface FetchPairDeviceBody {
  pairingCode: string;
  name?: string;
  stationName?: string;
}

export const fetchPairDevice = async (
  requestBody: FetchPairDeviceBody
): Promise<{ success: boolean; data: DeviceModel }> => {
  const response = await fetch('/api/v1/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to pair device: ${response.statusText}`);
  }

  return response.json();
};
