// Run: npm test (frontend), typechecked with tsconfig.test.json. Keeps the web's pairing-code format in line with the display (KV7-9P2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPairingCode, normalizePairingCode } from './pairing-code.ts';

test('formats like the display: three, hyphen, three', () => {
  assert.equal(formatPairingCode('KV79P2'), 'KV7-9P2');
  assert.equal(formatPairingCode('KV7-9P2'), 'KV7-9P2');
});

test('formats partial input while typing', () => {
  assert.equal(formatPairingCode('kv'), 'KV');
  assert.equal(formatPairingCode('kv7'), 'KV7');
  assert.equal(formatPairingCode('kv79'), 'KV7-9');
});

test('normalizes to what the API stores', () => {
  assert.equal(normalizePairingCode(' kv7-9p2 '), 'KV79P2');
  assert.equal(normalizePairingCode('KV7 9P2 EXTRA'), 'KV79P2');
});
