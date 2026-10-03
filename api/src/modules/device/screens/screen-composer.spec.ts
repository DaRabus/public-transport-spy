import {
  composeScreens,
  ComposeContext,
  stationsFor,
  DisplayProfile,
  ListWidget,
  ScreenWidget
} from './screen-composer';
import { TransitDepartureDto } from '../../transit/dto/transit-departure.dto';

const NOW = 1780000000;

function dep(
  minutes: number,
  line: string,
  destination: string,
  extra: Partial<TransitDepartureDto> = {}
) {
  return {
    timestamp: NOW + minutes * 60,
    line,
    destination,
    category: line.replace(/[\s\d]/g, ''),
    platform: null,
    delayMinutes: 0,
    ...extra
  };
}

const board = [
  dep(1, 'S2', 'Zürich Flughafen', { platform: '31', delayMinutes: 2 }),
  dep(3, 'IR 36', 'Basel SBB', { category: 'IR', platform: '7' }),
  dep(6, 'B32', 'Strassenverkehrsamt', { category: 'B' }),
  dep(9, 'S12', 'Winterthur'),
  dep(12, 'T10', 'Zürich Flughafen', { category: 'T' })
];

const ctx: ComposeContext = { defaultStation: 'Zürich HB', theme: 'standard', nowSec: NOW };
const boards = new Map([
  ['Zürich HB', board],
  ['Bern', [dep(4, 'IC 1', 'Genève-Aéroport', { category: 'IC' })]]
]);

function listOf(widgets: ScreenWidget[]): ListWidget {
  const list = widgets.find((w) => w.t === 'list');
  if (!list || list.t !== 'list') throw new Error('page has no list widget');
  return list;
}

describe('composeScreens', () => {
  it("renders today's board as the default when the device has no display profile", () => {
    const { pages } = composeScreens(null, ctx, boards);
    expect(pages).toHaveLength(1);
    const [page] = pages;
    expect(page.durationMs).toBe(15000);
    expect(page.widgets).toEqual(
      expect.arrayContaining([
        { t: 'text', x: 0, y: 12, w: 150, font: 'medium', text: 'Zürich HB' },
        { t: 'clock', x: 254, y: 12, font: 'medium', align: 'right', format: '%H:%M' },
        { t: 'line', x: 0, y: 16, w: 256 },
        { t: 'status', x: 212, y: 12, align: 'right' }
      ])
    );
    const list = listOf(page.widgets);
    expect(list).toMatchObject({ y: 30, rowH: 16, maxRows: 3, font: 'regular', leadSec: 0 });
    expect(list.cols.map((c) => c.kind ?? 'text')).toEqual(['countdown', 'text', 'text']);
    expect(list.items[0]).toEqual({ ts: NOW + 60, cells: ['S2', 'Zürich Flughafen'] });
  });

  it('orders rows by actual departure time, so a delayed train never shows above one leaving sooner', () => {
    // Upstream lists by timetable; S15 is scheduled first but runs 3 min late (timestamp includes the delay).
    const upstreamOrder = [
      dep(4, 'S15', 'Niederweningen', { delayMinutes: 3 }),
      dep(2, 'IR 36', 'Zürich Flughafen')
    ];
    const list = listOf(
      composeScreens(null, ctx, new Map([['Zürich HB', upstreamOrder]])).pages[0].widgets
    );
    expect(list.items.map((i) => i.cells[0])).toEqual(['IR 36', 'S15']);
  });

  it('applies line, category, direction and walking-time filters', () => {
    const profile: DisplayProfile = {
      pages: [
        {
          type: 'departures',
          categories: ['s', 't'],
          destinationContains: 'flughafen',
          walkMinutes: 2
        }
      ]
    };
    const list = listOf(composeScreens(profile, ctx, boards).pages[0].widgets);
    // S2 leaves in 1 min (< 2 min walk) and is dropped; IR/B/S12-Winterthur are filtered out.
    expect(list.items.map((i) => i.cells[0])).toEqual(['T10']);
    expect(list.leadSec).toBe(120);

    const byLine = listOf(
      composeScreens({ pages: [{ type: 'departures', lines: ['ir36', 'S 12'] }] }, ctx, boards)
        .pages[0].widgets
    );
    expect(byLine.items.map((i) => i.cells[0])).toEqual(['IR 36', 'S12']);

    const excluded = listOf(
      composeScreens({ pages: [{ type: 'departures', excludeLines: ['S2'] }] }, ctx, boards)
        .pages[0].widgets
    );
    expect(excluded.items.map((i) => i.cells[0])).not.toContain('S2');
  });

  it('adds platform, delay and absolute-time columns on request', () => {
    const list = listOf(
      composeScreens(
        {
          pages: [{ type: 'departures', showPlatform: true, showDelay: true, timeFormat: 'clock' }]
        },
        ctx,
        boards
      ).pages[0].widgets
    );
    expect(list.cols.map((c) => c.kind ?? 'text')).toEqual([
      'time',
      'text',
      'text',
      'text',
      'text'
    ]);
    expect(list.items[0].cells).toEqual(['S2', '31', 'Zürich Flughafen', '+2']);
    expect(list.items[1].cells).toEqual(['IR 36', '7', 'Basel SBB', '']);
    // Two-track platforms like "43/44" are about 23 px wide in the 8 px font.
    expect(list.cols[2].w).toBeGreaterThanOrEqual(28);
    const last = list.cols[list.cols.length - 1];
    expect(last.x + last.w).toBeLessThanOrEqual(256);
  });

  it.each([1, 2, 3, 4])('keeps a %i-row board inside the 64 px panel', (rows) => {
    const list = listOf(
      composeScreens({ pages: [{ type: 'departures', rows }] }, ctx, boards).pages[0].widgets
    );
    expect(list.maxRows).toBe(rows);
    expect(list.y + (rows - 1) * list.rowH).toBeLessThanOrEqual(63);
  });

  it('uses the page station and custom title, and the retro theme fonts', () => {
    const page = composeScreens(
      { pages: [{ type: 'departures', station: 'Bern', title: 'To the airport' }] },
      { ...ctx, theme: 'retro' },
      boards
    ).pages[0];
    expect(page.widgets).toContainEqual({
      t: 'text',
      x: 0,
      y: 12,
      w: 150,
      font: 'retro',
      text: 'To the airport'
    });
    expect(listOf(page.widgets).items[0].cells[0]).toBe('IC 1');
    expect(listOf(page.widgets).font).toBe('small');
  });

  it('builds clock and message pages with their durations', () => {
    const { pages } = composeScreens(
      {
        pages: [
          { type: 'clock', showDate: true, durationSec: 5 },
          { type: 'message', text: 'Happy\nBirthday!' }
        ]
      },
      ctx,
      boards
    );
    expect(pages[0].durationMs).toBe(5000);
    expect(pages[0].widgets).toEqual(
      expect.arrayContaining([
        { t: 'clock', x: 128, y: 40, font: 'xl', align: 'center', format: '%H:%M' },
        { t: 'clock', x: 128, y: 60, font: 'regular', align: 'center', format: '%a %d.%m.%Y' }
      ])
    );
    expect(pages[1].durationMs).toBe(8000);
    const texts = pages[1].widgets.filter((w) => w.t === 'text');
    expect(texts.map((w) => (w.t === 'text' ? w.text : ''))).toEqual(['Happy', 'Birthday!']);
  });

  it('tells the truth when a list is empty', () => {
    const emptyOf = (
      b: Map<string, TransitDepartureDto[] | null>,
      profile: DisplayProfile | null = null
    ) => listOf(composeScreens(profile, ctx, b).pages[0].widgets);

    // Night: the station genuinely has nothing scheduled.
    expect(emptyOf(new Map([['Zürich HB', []]]))).toMatchObject({
      items: [],
      empty: 'No departures scheduled right now'
    });
    // Departures exist, the owner's filters removed them all.
    expect(emptyOf(boards, { pages: [{ type: 'departures', lines: ['S99'] }] })).toMatchObject({
      items: [],
      empty: 'No matching departures right now'
    });
    // Timetable provider unreachable: never invent departures.
    expect(emptyOf(new Map([['Zürich HB', null]]))).toMatchObject({
      items: [],
      empty: 'Timetable temporarily unavailable'
    });
  });

  it('stays within the firmware limits for the largest allowed profile', () => {
    const big: DisplayProfile = {
      pages: Array.from({ length: 6 }, () => ({
        type: 'departures' as const,
        showPlatform: true,
        showDelay: true,
        rows: 4
      }))
    };
    const longBoard = Array.from({ length: 40 }, (_, i) =>
      dep(i + 1, 'IR 36', 'Zürich Flughafen Bahnhof', { platform: '12', delayMinutes: 5 })
    );
    const res = composeScreens(big, ctx, new Map([['Zürich HB', longBoard]]));
    expect(res.pages.length).toBeLessThanOrEqual(6);
    for (const page of res.pages) {
      expect(page.widgets.length).toBeLessThanOrEqual(24);
      expect(listOf(page.widgets).items.length).toBeLessThanOrEqual(10);
    }
    expect(JSON.stringify(res).length).toBeLessThan(8192);
  });

  it('keeps the largest profile under 8 KB even with very long destination names', () => {
    const big: DisplayProfile = {
      pages: Array.from({ length: 6 }, () => ({
        type: 'departures' as const,
        showPlatform: true,
        showDelay: true,
        rows: 4
      }))
    };
    const longName = 'Zürich Flughafen, Bahnhofplatz Süd/Nord Ausgang Richtung Kloten und Opfikon';
    const longBoard = Array.from({ length: 40 }, (_, i) =>
      dep(i + 1, 'IR 36', longName, { platform: '43/44', delayMinutes: 12 })
    );
    const res = composeScreens(big, ctx, new Map([['Zürich HB', longBoard]]));
    expect(Buffer.byteLength(JSON.stringify(res))).toBeLessThan(8192);
    expect(listOf(res.pages[0].widgets).items[0].cells[2]).toHaveLength(28);
  });
});

describe('stationsFor', () => {
  it('lists each distinct station once, defaulting to the device station', () => {
    expect(stationsFor(null, 'Zürich HB')).toEqual(['Zürich HB']);
    expect(
      stationsFor(
        {
          pages: [
            { type: 'departures' },
            { type: 'departures', station: 'Bern' },
            { type: 'clock' },
            { type: 'departures', station: 'Bern' }
          ]
        },
        'Zürich HB'
      )
    ).toEqual(['Zürich HB', 'Bern']);
  });
});
