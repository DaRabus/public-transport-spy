/**
 * Pairing codes: 6 characters from an alphabet without 0/O/1/I, stored and sent without separators
 * (KV79P2). The display and the web UI show them grouped as KV7-9P2; input accepts both forms.
 * Keep in sync with the firmware (`newPairingCode` in main.cpp) and `frontend/src/helpers/pairing-code.ts`.
 */
export const PAIRING_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/;
export const PAIRING_CODE_MESSAGE =
  'pairingCode must be 6 characters (letters A-Z and digits 2-9, no 0, 1, O or I); spaces and dashes are ignored';

/** Removes spaces/dashes and upper-cases; non-strings are returned untouched so validation rejects them. */
export function normalizePairingCode(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : value;
}
