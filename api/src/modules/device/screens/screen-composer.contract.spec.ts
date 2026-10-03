import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeScreens, DisplayProfile } from './screen-composer';

/**
 * Cross-stack contract: the composed layout for a fixed profile is pinned in a fixture that the
 * firmware's native test suite (on-chip-software/test/test_contract) renders through the device's own
 * row logic. Changing the composer output fails here until the fixture is regenerated with
 *   UPDATE_CONTRACT=1 npx jest screen-composer.contract
 * which then re-runs the firmware side against the new output (pio test -e native).
 */
const FIXTURE = resolve(
  __dirname,
  '../../../../../on-chip-software/test/test_contract/screens.fixture.json'
);
const NOW = 1780000000;

const dep = (
  minutes: number,
  line: string,
  destination: string,
  category: string,
  platform: string | null,
  delayMinutes = 0
) => ({
  timestamp: NOW + minutes * 60,
  line,
  destination,
  category,
  platform,
  delayMinutes
});

const boards = new Map([
  [
    'Zürich HB',
    [
      dep(1, 'S2', 'Zürich Flughafen', 'S', '31', 2),
      dep(3, 'IR 36', 'Basel SBB', 'IR', '7'),
      dep(6, 'B32', 'Strassenverkehrsamt', 'B', null),
      dep(9, 'S12', 'Winterthur', 'S', '33'),
      dep(12, 'T10', 'Zürich Flughafen', 'T', null)
    ]
  ]
]);

const PROFILE: DisplayProfile = {
  pages: [
    { type: 'departures' },
    {
      type: 'departures',
      showPlatform: true,
      showDelay: true,
      timeFormat: 'clock',
      walkMinutes: 2,
      rows: 4
    },
    { type: 'clock', showDate: true, durationSec: 5 },
    { type: 'message', text: 'Gone fishing\nBack Monday' }
  ]
};

describe('screen contract fixture', () => {
  it('matches the fixture the firmware contract test reads', () => {
    const json = `${JSON.stringify(composeScreens(PROFILE, { defaultStation: 'Zürich HB', theme: 'standard', nowSec: NOW }, boards), null, 2)}\n`;
    if (process.env.UPDATE_CONTRACT) writeFileSync(FIXTURE, json);
    expect(existsSync(FIXTURE)).toBe(true);
    expect(readFileSync(FIXTURE, 'utf8')).toBe(json);
  });
});
