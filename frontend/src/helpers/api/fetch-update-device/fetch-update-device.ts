import type { DeviceModel, DisplayProfile, Theme } from '@helpers/types';

export interface FetchUpdateDeviceBody {
  uuid: string;
  name?: string;
  stationName?: string;
  timezone?: string;
  theme?: Theme;
  apiInterval?: number;
  screenInterval?: number;
  display?: DisplayProfile | null;
  isConfigured?: boolean;
  scheduleEnabled?: boolean;
  scheduleOn?: number;
  scheduleOff?: number;
  scheduleDays?: number;
}

export const fetchUpdateDevice = async ({
  uuid,
  ...patch
}: FetchUpdateDeviceBody): Promise<{ success: boolean; data: DeviceModel }> => {
  const response = await fetch(`/api/v1/devices/${encodeURIComponent(uuid)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Validation failures arrive as a list of messages.
    const detail = Array.isArray(errorData.error) ? errorData.error.join('; ') : errorData.error;
    throw new Error(detail || `Failed to update device: ${response.statusText}`);
  }

  return response.json();
};
