/** Cancels the current user's pending pairing request (identified by the row id, not a hardware UUID). */
export const fetchCancelPendingPairing = async (id: string): Promise<void> => {
  const response = await fetch(`/api/v1/devices/pending/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to cancel pairing: ${response.statusText}`);
  }
};
