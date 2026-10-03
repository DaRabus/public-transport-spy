// Run: npm test (frontend) — node:test, no extra dependencies (Node 24 strips the TypeScript types);
// typechecked with tsconfig.test.json.
// Renders the same backend-pinned fixture as the firmware's native contract test, with the same
// expectations, so backend composer, device and web preview provably agree on the layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  alignedX,
  formatClock,
  formatCountdown,
  isWithinSchedule,
  listItemVisible,
  localParts,
  nextPage,
  pageDurationMs,
  truncateToFit,
  visibleListRows,
  type ListCell,
  type ListWidget,
  type ScreensResponse
} from './screen-preview-logic.ts';

const NOW = 1780000000;
const fixture: ScreensResponse = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      '../../../../../../on-chip-software/test/test_contract/screens.fixture.json'
    ),
    'utf8'
  )
);
const listOn = (page: number) =>
  fixture.pages[page].widgets.find((w): w is ListWidget => w.t === 'list')!;
const utcHHMM = (ts: number) => new Date(ts * 1000).toISOString().slice(11, 16);
const texts = (rows: ListCell[][]) => rows.map((r) => r.map((c) => c.text));

test('default board: rows and countdowns match the firmware', () => {
  const rows = visibleListRows(listOn(0), NOW + 10, utcHHMM);
  assert.equal(rows.length, 3);
  assert.deepEqual(texts(rows).slice(0, 2), [
    ['Now', 'S2', 'Zürich Flughafen'],
    ["2'", 'IR 36', 'Basel SBB']
  ]);
});

test('rows move up as departures leave, without a new fetch', () => {
  const rows = visibleListRows(listOn(0), NOW + 4 * 60 + 10, utcHHMM);
  assert.equal(rows.length, 3);
  assert.deepEqual(texts(rows)[0], ["1'", 'B32', 'Strassenverkehrsamt']);
});

test('platform, delay, time column and walking time', () => {
  const rows = visibleListRows(listOn(1), NOW, utcHHMM);
  assert.equal(rows.length, 4);
  assert.deepEqual(texts(rows)[0], [utcHHMM(NOW + 180), 'IR 36', '7', 'Basel SBB', '']);
  assert.equal(rows[0][4].align, 'right');
  assert.equal(rows[0][4].x, listOn(1).cols[4].x + listOn(1).cols[4].w); // right anchor = column's right edge
  assert.equal(texts(visibleListRows(listOn(1), NOW + 120, utcHHMM))[0][1], 'B32');
});

test('row visibility and countdown text follow the firmware rules', () => {
  assert.equal(listItemVisible(NOW - 30, NOW, 0), true);
  assert.equal(listItemVisible(NOW - 60, NOW, 0), false);
  assert.equal(listItemVisible(NOW + 179, NOW, 180), false);
  assert.equal(formatCountdown(NOW + 59, NOW), 'Now');
  assert.equal(formatCountdown(NOW + 12 * 60 + 30, NOW), "12'");
});

test('text is cut on whole characters to fit the column', () => {
  const byChar = (s: string) => Array.from(s).length * 6;
  assert.equal(truncateToFit('Zürich HB', 60, byChar), 'Zürich HB');
  assert.equal(truncateToFit('Zürich HB', 13, byChar), 'Zü');
  assert.equal(truncateToFit('Zürich', 0, byChar), '');
});

test('alignment, rotation, durations and clock formats', () => {
  assert.equal(alignedX(254, 40, 'right'), 214);
  assert.equal(alignedX(128, 40, 'center'), 108);
  assert.equal(alignedX(10, 40, undefined), 10);
  assert.equal(nextPage(2, 3), 0);
  assert.equal(pageDurationMs({ durationMs: 500 }), 2000);
  assert.equal(pageDurationMs({}), 15000);
  const d = new Date(Date.UTC(2026, 9, 6, 5, 5)); // Tue 6 Oct 2026 05:05 UTC
  assert.equal(formatClock('%H:%M', d, 'UTC'), '05:05');
  assert.equal(formatClock('%a %d.%m.%Y', d, 'UTC'), 'Tue 06.10.2026');
  // The device's zone, not the browser's: 05:05 UTC is 07:05 in Zurich (CEST) and 01:05 in New York.
  assert.equal(formatClock('%H:%M', d, 'Europe/Zurich'), '07:05');
  assert.equal(formatClock('%H:%M', d, 'America/New_York'), '01:05');
  assert.deepEqual(localParts(d, 'Europe/Zurich'), {
    year: 2026,
    month: 10,
    day: 6,
    hour: 7,
    minute: 5,
    second: 0,
    weekday: 2
  });
});

test('schedule window matches the firmware rules', () => {
  const SUN = 0,
    MON = 1,
    FRI = 5,
    SAT = 6,
    WEEKDAYS = 0b0111110;
  assert.equal(isWithinSchedule(360, MON, 360, 1380, WEEKDAYS), true);
  assert.equal(isWithinSchedule(359, MON, 360, 1380, WEEKDAYS), false);
  assert.equal(isWithinSchedule(1380, MON, 360, 1380, WEEKDAYS), false);
  assert.equal(isWithinSchedule(720, SAT, 360, 1380, WEEKDAYS), false);
  assert.equal(isWithinSchedule(1380, FRI, 1080, 120, 1 << FRI), true);
  assert.equal(isWithinSchedule(60, SAT, 1080, 120, 1 << FRI), true);
  assert.equal(isWithinSchedule(60, FRI, 1080, 120, 1 << FRI), false);
  assert.equal(isWithinSchedule(180, SAT, 1080, 120, 1 << FRI), false);
  assert.equal(isWithinSchedule(0, SUN, 0, 0, 1 << SUN), true);
  assert.equal(isWithinSchedule(0, MON, 0, 0, 1 << SUN), false);
});
