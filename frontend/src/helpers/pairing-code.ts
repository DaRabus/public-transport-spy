/**
 * Pairing codes: 6 characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no 0/O/1/I), stored and sent
 * without separators (KV79P2). The display shows them grouped as KV7-9P2; the API accepts both.
 * Keep in sync with the firmware (`newPairingCode`) and the API (`pair-device.dto.ts`).
 */
export const PAIRING_CODE_LENGTH = 6;

/** What the API stores and expects: separators removed, upper case, at most 6 characters. */
export function normalizePairingCode(input: string): string {
  return input
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, PAIRING_CODE_LENGTH);
}

/** The grouped form shown on the display (KV79P2 -> KV7-9P2); also works for partial input. */
export function formatPairingCode(code: string): string {
  const c = normalizePairingCode(code);
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}
