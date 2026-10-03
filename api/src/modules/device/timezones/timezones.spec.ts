import { DEFAULT_TIMEZONE, TIMEZONES, toPosixTimezone } from './timezones';

describe('timezones', () => {
  it('maps IANA zones to the POSIX TZ strings the firmware needs', () => {
    expect(toPosixTimezone('Europe/Zurich')).toBe('CET-1CEST,M3.5.0,M10.5.0/3');
    expect(toPosixTimezone('Europe/London')).toBe('GMT0BST,M3.5.0/1,M10.5.0');
    expect(toPosixTimezone('America/New_York')).toBe('EST5EDT,M3.2.0,M11.1.0');
  });

  it('falls back to the default zone for anything unknown', () => {
    expect(DEFAULT_TIMEZONE).toBe('Europe/Zurich');
    expect(toPosixTimezone('Mars/Olympus_Mons')).toBe(TIMEZONES['Europe/Zurich']);
  });

  it('only lists zones that ICU accepts (canonical names or aliases like Europe/Kyiv)', () => {
    for (const iana of Object.keys(TIMEZONES)) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: iana })).not.toThrow();
    }
  });

  it('matches the real UTC offsets in January and July for every zone', () => {
    const offsetMinutes = (iana: string, date: Date) => {
      const name = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'longOffset' })
        .formatToParts(date)
        .find((p) => p.type === 'timeZoneName')!.value; // "GMT+01:00" or "GMT"
      const m = /GMT([+-])(\d\d):(\d\d)/.exec(name);
      return m ? (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
    };
    // POSIX: "CET-1CEST,..." = UTC+1 standard (sign inverted); DST is std+1h unless given explicitly.
    const posixOffsets = (posix: string) => {
      const m =
        /^(?:<[^>]+>|[A-Za-z]+)([+-]?)(\d+)(?::(\d\d))?(?:(<[^>]+>|[A-Za-z]+)(?:([+-]?)(\d+)(?::(\d\d))?)?(,.+))?$/.exec(
          posix
        );
      if (!m) throw new Error(`unparseable POSIX TZ ${posix}`);
      const std = (m[1] === '-' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
      if (!m[4]) return [std + 0, std + 0];
      const dst = m[6]
        ? (m[5] === '-' ? 1 : -1) * (Number(m[6]) * 60 + Number(m[7] ?? 0))
        : std + 60;
      return [Math.min(std, dst) + 0, Math.max(std, dst) + 0]; // + 0 turns -0 into 0
    };
    for (const [iana, posix] of Object.entries(TIMEZONES)) {
      const jan = offsetMinutes(iana, new Date(Date.UTC(2026, 0, 15)));
      const jul = offsetMinutes(iana, new Date(Date.UTC(2026, 6, 15)));
      expect({ iana, offsets: [Math.min(jan, jul), Math.max(jan, jul)] }).toEqual({
        iana,
        offsets: posixOffsets(posix)
      });
    }
  });
});
