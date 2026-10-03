/** Deletes the logged-in account (password required). Returns how many displays were released. */
export const fetchDeleteAccount = async (
  currentPassword: string
): Promise<{ releasedDevices: number }> => {
  const response = await fetch('/api/v1/user/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Failed to delete account: ${response.statusText}`);
  }
  return body.data;
};
