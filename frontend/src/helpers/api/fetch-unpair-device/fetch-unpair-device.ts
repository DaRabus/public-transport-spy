export interface FetchUnpairDeviceQuery {
  uuid: string;
}

export const fetchUnpairDevice = async ({
  uuid
}: FetchUnpairDeviceQuery): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/v1/devices/${encodeURIComponent(uuid)}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to unpair device: ${response.statusText}`);
  }

  return response.json();
};
