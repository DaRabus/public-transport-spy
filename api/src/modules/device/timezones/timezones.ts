/**
 * Supported device time zones: IANA name (stored on the device row, shown in the web app's picker)
 * -> POSIX TZ string (sent to the firmware, which feeds it to configTzTime()). The ESP32 has no tz
 * database, hence the curated table; the spec checks every entry against ICU's real offsets.
 * Add a zone by appending a line here.
 */
export const TIMEZONES: Record<string, string> = {
  UTC: 'UTC0',
  'Europe/London': 'GMT0BST,M3.5.0/1,M10.5.0',
  'Europe/Lisbon': 'WET0WEST,M3.5.0/1,M10.5.0',
  'Europe/Zurich': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Berlin': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Vienna': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Paris': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Rome': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Madrid': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Amsterdam': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Brussels': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Copenhagen': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Oslo': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Stockholm': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Warsaw': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Prague': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Budapest': 'CET-1CEST,M3.5.0,M10.5.0/3',
  'Europe/Athens': 'EET-2EEST,M3.5.0/3,M10.5.0/4',
  'Europe/Helsinki': 'EET-2EEST,M3.5.0/3,M10.5.0/4',
  'Europe/Bucharest': 'EET-2EEST,M3.5.0/3,M10.5.0/4',
  'Europe/Kyiv': 'EET-2EEST,M3.5.0/3,M10.5.0/4',
  'Europe/Istanbul': '<+03>-3',
  'Europe/Moscow': 'MSK-3',
  'Africa/Johannesburg': 'SAST-2',
  'Asia/Dubai': '<+04>-4',
  'Asia/Kolkata': 'IST-5:30',
  'Asia/Singapore': '<+08>-8',
  'Asia/Shanghai': 'CST-8',
  'Asia/Tokyo': 'JST-9',
  'Australia/Sydney': 'AEST-10AEDT,M10.1.0,M4.1.0/3',
  'Pacific/Auckland': 'NZST-12NZDT,M9.5.0,M4.1.0/3',
  'America/Sao_Paulo': '<-03>3',
  'America/New_York': 'EST5EDT,M3.2.0,M11.1.0',
  'America/Toronto': 'EST5EDT,M3.2.0,M11.1.0',
  'America/Chicago': 'CST6CDT,M3.2.0,M11.1.0',
  'America/Denver': 'MST7MDT,M3.2.0,M11.1.0',
  'America/Phoenix': 'MST7',
  'America/Los_Angeles': 'PST8PDT,M3.2.0,M11.1.0'
};

export const DEFAULT_TIMEZONE = 'Europe/Zurich';
export const TIMEZONE_IDS = Object.keys(TIMEZONES);

/** POSIX TZ string for the firmware; unknown zones fall back to the default. */
export function toPosixTimezone(iana: string): string {
  return TIMEZONES[iana] ?? TIMEZONES[DEFAULT_TIMEZONE];
}
