import type { DeviceModel } from '@helpers/types';

/** Transfers a display the logged-in user owns to another account by username. */
export const fetchTransferDevice = async (
  uuid: string,
  toUserName: string
): Promise<DeviceModel> => {
  const response = await fetch(`/api/v1/devices/${encodeURIComponent(uuid)}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ toUserName })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Failed to transfer display: ${response.statusText}`);
  }
  return body.data;
};
