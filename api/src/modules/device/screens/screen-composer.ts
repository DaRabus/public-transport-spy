import { TransitDepartureDto } from '../../transit/dto/transit-departure.dto';

/**
 * Turns a device's display profile (what the owner picked in the app) into the widget layout the
 * firmware renders (GET /api/v1/device/screens). Pure functions, no I/O: everything layout-related
 * lives here so new presets ship without a firmware update.
 *
 * Contract limits (enforced here, mirrored in the firmware): ≤ 6 pages, ≤ 24 widgets per page,
 * ≤ 10 list items, cell text ≤ 28 characters (the device truncates to the column width anyway, and
 * this keeps the response < 8 KB). Panel is 256x64; text baselines must stay ≤ 63.
 */

export const THEMES = ['standard', 'retro', 'bold'] as const;
export type Theme = (typeof THEMES)[number];

type FontName = 'small' | 'regular' | 'bold' | 'medium' | 'large' | 'xl' | 'retro';
type Align = 'left' | 'center' | 'right';

interface ListColumn {
  x: number;
  w: number;
  /** countdown = minutes until ts, time = HH:MM of ts (both computed on the device); default text = next cell */
  kind?: 'countdown' | 'time';
  align?: Align;
}

interface ListItem {
  ts: number;
  cells: string[];
}

export type ScreenWidget =
  | { t: 'text'; x: number; y: number; w?: number; font: FontName; text: string; align?: Align }
  | { t: 'clock'; x: number; y: number; font: FontName; align?: Align; format: string }
  | { t: 'line'; x: number; y: number; w?: number; h?: number }
  | { t: 'status'; x: number; y: number; align?: Align }
  | ListWidget;

export interface ListWidget {
  t: 'list';
  y: number;
  rowH: number;
  maxRows: number;
  font: FontName;
  /** Items leaving sooner than this are hidden on the device (walking time). */
  leadSec: number;
  empty: string;
  cols: ListColumn[];
  items: ListItem[];
}

interface ScreenPage {
  durationMs: number;
  widgets: ScreenWidget[];
}

export interface ScreensResponse {
  pages: ScreenPage[];
}

interface DisplayPageConfig {
  type: 'departures' | 'clock' | 'message';
  durationSec?: number;
  // departures
  station?: string;
  title?: string;
  rows?: number;
  timeFormat?: 'countdown' | 'clock';
  showPlatform?: boolean;
  showDelay?: boolean;
  lines?: string[];
  excludeLines?: string[];
  categories?: string[];
  destinationContains?: string;
  walkMinutes?: number;
  // clock
  showDate?: boolean;
  // message
  text?: string;
}

export interface DisplayProfile {
  pages: DisplayPageConfig[];
}

export interface ComposeContext {
  defaultStation: string;
  theme: Theme;
  nowSec: number;
}

export const MAX_PAGES = 6;
const MAX_LIST_ITEMS = 10;
const MAX_CELL_CHARS = 28;
const DEFAULT_PROFILE: DisplayProfile = { pages: [{ type: 'departures' }] };

/** Row layouts that keep every baseline inside the 64 px panel. */
const ROW_LAYOUTS: Record<number, { y: number; rowH: number; font: FontName; scale: number }> = {
  1: { y: 44, rowH: 18, font: 'large', scale: 1.4 },
  2: { y: 34, rowH: 20, font: 'bold', scale: 1 },
  3: { y: 30, rowH: 16, font: 'regular', scale: 1 },
  4: { y: 27, rowH: 12, font: 'regular', scale: 1 }
};

/** Panel geometry (px). The header sits on one baseline; the list fills the rest. */
const PANEL_RIGHT = 254; // last usable column, right-aligned text ends here
const HEADER_Y = 12;
const HEADER_RULE_Y = 16;
const HEADER_TITLE_W = 150;
const HEADER_STATUS_X = 212;
/** Column widths at scale 1: time (countdown | clock), line, platform, delay; gaps between columns. */
const COL_W = { countdown: 32, clock: 34, line: 56, platform: 28, delay: 22 };
const COL_GAP = 4;
const TIME_GAP = 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const normLine = (s: string) => s.replace(/\s+/g, '').toUpperCase();

const pageStation = (page: DisplayPageConfig, defaultStation: string) =>
  page.station?.trim() || defaultStation;

export function stationsFor(profile: DisplayProfile | null, defaultStation: string): string[] {
  const pages = (profile ?? DEFAULT_PROFILE).pages.slice(0, MAX_PAGES);
  const stations = pages
    .filter((p) => p.type === 'departures')
    .map((p) => pageStation(p, defaultStation));
  return [...new Set(stations)];
}

export function composeScreens(
  profile: DisplayProfile | null,
  ctx: ComposeContext,
  boards: Map<string, TransitDepartureDto[] | null>
): ScreensResponse {
  const pages = (profile ?? DEFAULT_PROFILE).pages.slice(0, MAX_PAGES).map((page) => {
    const durationMs =
      clamp(page.durationSec ?? (page.type === 'departures' ? 15 : 8), 3, 300) * 1000;
    switch (page.type) {
      case 'clock':
        return { durationMs, widgets: clockPage(page) };
      case 'message':
        return { durationMs, widgets: messagePage(page) };
      default:
        return { durationMs, widgets: departuresPage(page, ctx, boards) };
    }
  });
  return { pages };
}

function departuresPage(
  page: DisplayPageConfig,
  ctx: ComposeContext,
  boards: Map<string, TransitDepartureDto[] | null>
): ScreenWidget[] {
  const station = pageStation(page, ctx.defaultStation);
  const rows = clamp(Math.round(page.rows ?? 3), 1, 4);
  const layout = ROW_LAYOUTS[rows];
  const leadSec = clamp(Math.round(page.walkMinutes ?? 0), 0, 60) * 60;
  const board = boards.get(station);

  return [
    {
      t: 'text',
      x: 0,
      y: HEADER_Y,
      w: HEADER_TITLE_W,
      font: ctx.theme === 'retro' ? 'retro' : 'medium',
      text: page.title?.trim() || station
    },
    { t: 'status', x: HEADER_STATUS_X, y: HEADER_Y, align: 'right' },
    { t: 'clock', x: PANEL_RIGHT, y: HEADER_Y, font: 'medium', align: 'right', format: '%H:%M' },
    { t: 'line', x: 0, y: HEADER_RULE_Y, w: 256 },
    {
      t: 'list',
      y: layout.y,
      rowH: layout.rowH,
      maxRows: rows,
      font: rowFontFor(ctx.theme, rows, layout.font),
      leadSec,
      empty: emptyMessage(board),
      cols: columnsFor(page, layout.scale),
      items: selectDepartures(board, page, ctx.nowSec + leadSec)
    }
  ];
}

function rowFontFor(theme: Theme, rows: number, layoutFont: FontName): FontName {
  if (theme === 'retro') return rows >= 3 ? 'small' : 'retro';
  if (theme === 'bold' && rows >= 3) return 'bold';
  return layoutFont;
}

/** time | line | [platform] | destination (takes the rest) | [delay, right-aligned]. */
function columnsFor(page: DisplayPageConfig, scale: number): ListColumn[] {
  const px = (w: number) => Math.round(w * scale);
  const clock = page.timeFormat === 'clock';
  const cols: ListColumn[] = [];
  let x = 0;

  const timeW = px(clock ? COL_W.clock : COL_W.countdown);
  cols.push({ x, w: timeW, kind: clock ? 'time' : 'countdown' });
  x += timeW + TIME_GAP;

  cols.push({ x, w: px(COL_W.line) });
  x += px(COL_W.line) + COL_GAP;

  if (page.showPlatform) {
    cols.push({ x, w: px(COL_W.platform) }); // fits two-track platforms like "43/44" (device ~24 px, preview font ~27 px)
    x += px(COL_W.platform) + COL_GAP;
  }

  const delayW = page.showDelay ? px(COL_W.delay) : 0;
  cols.push({ x, w: PANEL_RIGHT - x - (delayW ? delayW + TIME_GAP : 0) });
  if (delayW) cols.push({ x: PANEL_RIGHT - delayW, w: delayW, align: 'right' });
  return cols;
}

/** Applies the owner's filters to the board and shapes the rows (cells follow `columnsFor`). */
function selectDepartures(
  board: TransitDepartureDto[] | null | undefined,
  page: DisplayPageConfig,
  earliestSec: number
): ListItem[] {
  const include = new Set((page.lines ?? []).map(normLine));
  const exclude = new Set((page.excludeLines ?? []).map(normLine));
  const categories = new Set((page.categories ?? []).map((c) => c.trim().toUpperCase()));
  const direction = page.destinationContains?.trim().toLowerCase();
  const cell = (text: string) => text.slice(0, MAX_CELL_CHARS);

  return (
    [...(board ?? [])]
      // Upstream lists by timetable, but timestamps include delays: sort so countdowns read top-down.
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter((d) => d.timestamp >= earliestSec)
      .filter((d) => include.size === 0 || include.has(normLine(d.line)))
      .filter((d) => !exclude.has(normLine(d.line)))
      .filter((d) => categories.size === 0 || categories.has((d.category ?? '').toUpperCase()))
      .filter((d) => !direction || d.destination.toLowerCase().includes(direction))
      .slice(0, MAX_LIST_ITEMS)
      .map((d) => ({
        ts: d.timestamp,
        cells: [
          cell(d.line),
          ...(page.showPlatform ? [cell(d.platform ?? '')] : []),
          cell(d.destination),
          ...(page.showDelay ? [d.delayMinutes ? `+${d.delayMinutes}` : ''] : [])
        ]
      }))
  );
}

function clockPage(page: DisplayPageConfig): ScreenWidget[] {
  const widgets: ScreenWidget[] = [
    { t: 'status', x: PANEL_RIGHT, y: 10, align: 'right' },
    { t: 'clock', x: 128, y: 40, font: 'xl', align: 'center', format: '%H:%M' }
  ];
  if (page.showDate) {
    widgets.push({
      t: 'clock',
      x: 128,
      y: 60,
      font: 'regular',
      align: 'center',
      format: '%a %d.%m.%Y'
    });
  }
  return widgets;
}

function messagePage(page: DisplayPageConfig): ScreenWidget[] {
  const lines = (page.text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);
  const font: FontName = lines.length === 1 ? 'large' : 'medium';
  const top = Math.round((64 - lines.length * 18) / 2);
  return [
    { t: 'status', x: PANEL_RIGHT, y: 10, align: 'right' },
    ...lines.map((text, i): ScreenWidget => ({
      t: 'text',
      x: 128,
      y: top + 14 + i * 18,
      w: 252,
      font,
      text,
      align: 'center'
    }))
  ];
}

/**
 * What the device shows when a list has no rows. Never pretend: a night without service, the owner's
 * filters and an unreachable timetable provider each get their own message.
 */
function emptyMessage(board: TransitDepartureDto[] | null | undefined): string {
  if (board === null || board === undefined) return 'Timetable temporarily unavailable';
  if (board.length === 0) return 'No departures scheduled right now';
  return 'No matching departures right now';
}
