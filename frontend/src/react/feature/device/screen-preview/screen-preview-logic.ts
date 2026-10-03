// Browser port of the firmware's screen rules (on-chip-software/include/device_logic.h + screen_logic.h)
// for the live preview. Pure and import-free so `node --test` can run it directly; the test renders the
// same backend-pinned contract fixture as the firmware, so all three stay in agreement.

type FontName = 'small' | 'regular' | 'bold' | 'medium' | 'large' | 'xl' | 'retro';
type Align = 'left' | 'center' | 'right';

interface ListColumn {
  x: number;
  w: number;
  kind?: 'countdown' | 'time';
  align?: Align;
}

export interface ListWidget {
  t: 'list';
  y: number;
  rowH: number;
  maxRows: number;
  font: FontName;
  leadSec: number;
  empty: string;
  cols: ListColumn[];
  items: Array<{ ts: number; cells: string[] }>;
}

type ScreenWidget =
  | { t: 'text'; x: number; y: number; w?: number; font: FontName; text: string; align?: Align }
  | { t: 'clock'; x: number; y: number; font: FontName; align?: Align; format: string }
  | { t: 'line'; x: number; y: number; w?: number; h?: number }
  | { t: 'status'; x: number; y: number; align?: Align }
  | ListWidget;

export interface ScreenPage {
  durationMs: number;
  widgets: ScreenWidget[];
}

export interface ScreensResponse {
  pages: ScreenPage[];
}

export interface ListCell {
  x: number;
  width: number;
  align: Align;
  text: string;
}

const MAX_PAGES = 6;
export const MAX_WIDGETS = 24;
const MAX_LIST_ITEMS = 10;

const SANS = 'Helvetica, Arial, sans-serif';
/** Canvas approximations of the firmware's U8g2 bitmap fonts (sizes chosen to match their pixel heights). */
const FONT_CSS: Record<FontName, string> = {
  small: '8px monospace',
  regular: `11px ${SANS}`,
  bold: `bold 11px ${SANS}`,
  medium: `bold 14px ${SANS}`,
  large: `bold 16px ${SANS}`,
  xl: `bold 33px ${SANS}`,
  retro: 'bold 9px monospace'
};

/** Unknown fonts fall back to "regular", like the firmware. */
export function fontCss(name: string | undefined): string {
  return FONT_CSS[name as FontName] ?? FONT_CSS.regular;
}

/** Hidden once more than a minute gone, or when leaving sooner than the walking time (leadSec). */
export function listItemVisible(
  ts: number,
  nowSec: number,
  leadSec: number,
  timeOk = true
): boolean {
  if (!timeOk) return true;
  const secondsLeft = ts - nowSec;
  return secondsLeft >= (leadSec > 0 ? leadSec : -59);
}

/** "Now" for the current minute, otherwise whole minutes left: 7' */
export function formatCountdown(ts: number, nowSec: number): string {
  const minutes = Math.trunc((ts - nowSec) / 60);
  return minutes <= 0 ? 'Now' : `${minutes}'`;
}

/** Widget anchor -> left edge. */
export function alignedX(x: number, width: number, align: string | undefined): number {
  if (align === 'right') return x - width;
  if (align === 'center') return x - Math.trunc(width / 2);
  return x;
}

/** Drops whole characters from the end until the text fits. */
export function truncateToFit(
  text: string,
  maxWidth: number,
  measure: (s: string) => number
): string {
  const chars = Array.from(text);
  while (chars.length > 0 && measure(chars.join('')) > maxWidth) chars.pop();
  return chars.join('');
}

/** The rows a list widget shows at nowSec, with each cell's text and anchor. */
export function visibleListRows(
  list: ListWidget,
  nowSec: number,
  hhmm: (ts: number) => string,
  timeOk = true
): ListCell[][] {
  const rows: ListCell[][] = [];
  for (const item of list.items.slice(0, MAX_LIST_ITEMS)) {
    if (rows.length >= list.maxRows) break;
    if (!listItemVisible(item.ts, nowSec, list.leadSec ?? 0, timeOk)) continue;
    let cell = 0;
    rows.push(
      list.cols.map((col) => {
        const align = col.align ?? 'left';
        let text: string;
        if (col.kind === 'countdown') text = timeOk ? formatCountdown(item.ts, nowSec) : '--';
        else if (col.kind === 'time') text = hhmm(item.ts);
        else text = item.cells[cell++] ?? '';
        const x =
          align === 'right'
            ? col.x + col.w
            : align === 'center'
              ? col.x + Math.trunc(col.w / 2)
              : col.x;
        return { x, width: col.w, align, text };
      })
    );
  }
  return rows;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday, like the firmware's tm_wday */
  weekday: number;
}

/** Wall-clock parts of `date` in an IANA zone (the device's), or the browser's zone when omitted. */
export function localParts(date: Date, timeZone?: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: DAYS.indexOf(parts.weekday)
  };
}

/** The strftime subset the composer uses (%H %M %S %a %d %m %Y), in the device's time zone. */
export function formatClock(format: string, d: Date, timeZone?: string): string {
  const t = localParts(d, timeZone);
  const values: Record<string, string> = {
    H: pad(t.hour),
    M: pad(t.minute),
    S: pad(t.second),
    a: DAYS[t.weekday],
    d: pad(t.day),
    m: pad(t.month),
    Y: String(t.year),
    '%': '%'
  };
  return format.replace(/%([HMSadmY%])/g, (_, k: string) => values[k]);
}

/**
 * Port of the firmware's isWithinSchedule(): minuteOfDay 0-1439, weekday 0 = Sunday; the window
 * belongs to the weekday it starts on (18:00-02:00 Friday covers early Saturday); on == off = all day.
 */
export function isWithinSchedule(
  minuteOfDay: number,
  weekday: number,
  on: number,
  off: number,
  dayBits: number
): boolean {
  const selected = (day: number) => ((dayBits >> ((day + 7) % 7)) & 1) === 1;
  if (on === off) return selected(weekday);
  if (on < off) return selected(weekday) && minuteOfDay >= on && minuteOfDay < off;
  return (selected(weekday) && minuteOfDay >= on) || (selected(weekday - 1) && minuteOfDay < off);
}

export function nextPage(current: number, count: number): number {
  return count <= 0 ? 0 : (current + 1) % count;
}

/** Same clamp as the firmware (2 s - 5 min, default 15 s). */
export function pageDurationMs(page: { durationMs?: number }): number {
  const ms = page.durationMs ?? 0;
  if (ms <= 0) return 15000;
  return Math.min(300000, Math.max(2000, ms));
}
