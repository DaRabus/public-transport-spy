'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Chip, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import type { DisplayPage } from '@helpers/types';
import {
  alignedX,
  fontCss,
  formatClock,
  isWithinSchedule,
  localParts,
  MAX_WIDGETS,
  nextPage,
  pageDurationMs,
  ScreenPage,
  ScreensResponse,
  truncateToFit,
  visibleListRows
} from './screen-preview-logic';

const WIDTH = 256;
const HEIGHT = 64;
const OLED = { r: 255, g: 213, b: 0 }; // yellow SSD1322 panel
const PAGE_LABELS: Record<DisplayPage['type'], string> = {
  departures: 'Departures',
  clock: 'Clock',
  message: 'Message'
};

export interface ScreenPreviewPower {
  /** false = the owner switched the display off */
  enabled: boolean;
  /** on/off window in minutes after midnight + weekday bits (bit 0 = Sunday); null = always on */
  schedule: { on: number; off: number; days: number } | null;
}

export interface ScreenPreviewDraft {
  pages: DisplayPage[];
  stationName: string;
  theme: string;
}

const hhmmText = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Why the panel is dark right now (disabled / outside the schedule), or null when it is on. */
function offReason(
  power: ScreenPreviewPower | undefined,
  now: Date,
  timeZone?: string
): string | null {
  if (!power) return null;
  if (!power.enabled) return 'Display switched off';
  const { schedule } = power;
  if (!schedule) return null;
  const t = localParts(now, timeZone);
  return isWithinSchedule(
    t.hour * 60 + t.minute,
    t.weekday,
    schedule.on,
    schedule.off,
    schedule.days
  )
    ? null
    : `Off by schedule · on ${hhmmText(schedule.on)}–${hhmmText(schedule.off)}`;
}

/** Draws one composed page the way the firmware's renderPage() does, then snaps it to 1-bit OLED pixels. */
function drawPage(
  ctx: CanvasRenderingContext2D,
  page: ScreenPage,
  now: Date,
  showOffline: boolean,
  timeZone?: string
) {
  const nowSec = Math.floor(now.getTime() / 1000);
  const hhmm = (ts: number) => formatClock('%H:%M', new Date(ts * 1000), timeZone);
  const measure = (s: string) => ctx.measureText(s).width;
  const text = (x: number, y: number, value: string, maxWidth: number, align?: string) => {
    const fitted = truncateToFit(value, maxWidth, measure);
    ctx.fillText(fitted, alignedX(x, measure(fitted), align), y);
  };

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';

  let statusDrawn = false;
  for (const w of page.widgets.slice(0, MAX_WIDGETS)) {
    switch (w.t) {
      case 'text':
        ctx.font = fontCss(w.font);
        text(w.x, w.y, w.text, w.w ?? WIDTH, w.align);
        break;
      case 'clock':
        ctx.font = fontCss(w.font);
        text(w.x, w.y, formatClock(w.format, now, timeZone), WIDTH, w.align);
        break;
      case 'line':
        if (w.h) ctx.fillRect(w.x, w.y, 1, w.h);
        else ctx.fillRect(w.x, w.y, w.w ?? WIDTH, 1);
        break;
      case 'status':
        statusDrawn = true;
        if (showOffline) {
          ctx.font = fontCss('regular');
          text(w.x, w.y, '[OFFLINE]', WIDTH, w.align);
        }
        break;
      case 'list': {
        ctx.font = fontCss(w.font);
        const rows = visibleListRows(w, nowSec, hhmm);
        rows.forEach((row, r) =>
          row.forEach((cell) => text(cell.x, w.y + r * w.rowH, cell.text, cell.width, cell.align))
        );
        if (rows.length === 0) text(0, w.y, w.empty, 254);
        break;
      }
      // Unknown widget types are skipped, exactly like the firmware.
    }
  }
  if (showOffline && !statusDrawn) {
    ctx.font = fontCss('regular');
    text(254, 10, '[OFFLINE]', WIDTH, 'right');
  }

  // The OLED has no anti-aliasing: threshold to lit/unlit pixels in the panel colour.
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < image.data.length; i += 4) {
    const lit = image.data[i] > 110;
    image.data[i] = lit ? OLED.r : 0;
    image.data[i + 1] = lit ? OLED.g : 0;
    image.data[i + 2] = lit ? OLED.b : 0;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Live preview of the display: the backend composes the unsaved form values with the same composer the
 * device uses (POST .../screens/preview), and this draws the result like the firmware does.
 */
export function ScreenPreview({
  uuid,
  draft,
  timeZone,
  power,
  compact = false
}: {
  uuid: string;
  /** Unsaved form values; omitted = the device's stored settings (dashboard). */
  draft?: ScreenPreviewDraft;
  /** Device IANA zone, so clock and departure times match the display. */
  timeZone?: string;
  power?: ScreenPreviewPower;
  /** Panel only, no page tabs, switches or notes (dashboard cards). */
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screens, setScreens] = useState<ScreensResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showOffline, setShowOffline] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [refreshTick, setRefreshTick] = useState(0);

  const draftKey = draft ? JSON.stringify(draft) : '';

  // Compose on the server 400 ms after the last edit, and again every minute for fresh departures.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const parsed = draftKey ? (JSON.parse(draftKey) as ScreenPreviewDraft) : null;
        const res = await fetch(`/api/v1/devices/${encodeURIComponent(uuid)}/screens/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify(
            parsed
              ? {
                  display: { pages: parsed.pages },
                  stationName: parsed.stationName,
                  theme: parsed.theme
                }
              : {}
          )
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error || `Preview failed (${res.status})`);
          return;
        }
        setScreens(body.data);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError((err as Error).message);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [uuid, draftKey, refreshTick]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    const refresh = setInterval(() => setRefreshTick((t) => t + 1), 60000);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  const pageCount = screens?.pages.length ?? 0;
  const currentIndex = pageIndex < pageCount ? pageIndex : 0;
  const page = screens?.pages[currentIndex];

  useEffect(() => {
    if (!autoRotate || pageCount < 2 || !page) return;
    const timer = setTimeout(
      () => setPageIndex(nextPage(currentIndex, pageCount)),
      pageDurationMs(page)
    );
    return () => clearTimeout(timer);
  }, [autoRotate, currentIndex, pageCount, page]);

  const off = offReason(power, now, timeZone);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    if (off) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, WIDTH, HEIGHT); // the device powers the panel down
    } else if (page) {
      drawPage(ctx, page, now, showOffline, timeZone);
    }
  }, [page, now, showOffline, timeZone, off]);

  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          backgroundColor: '#000',
          border: '3px solid #222',
          borderRadius: 1,
          p: 1,
          position: 'relative'
        }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          aria-label="Display preview"
          style={{
            width: '100%',
            aspectRatio: '4 / 1',
            imageRendering: 'pixelated',
            display: 'block'
          }}
        />
        {(off || !page) && (
          <Typography
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              color: '#666'
            }}
          >
            {off ?? (error ? 'Preview unavailable' : 'Loading preview...')}
          </Typography>
        )}
      </Box>

      {compact ? null : (
        <>
          {error && (
            <Typography sx={{ fontSize: 12, color: 'var(--a2, #ff6b6b)' }}>{error}</Typography>
          )}

          {pageCount > 1 && (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {screens!.pages.map((p, i) => (
                <Chip
                  key={i}
                  size="small"
                  label={`${i + 1} · ${draft ? PAGE_LABELS[draft.pages[i]?.type ?? 'departures'] : 'Page'} · ${pageDurationMs(p) / 1000}s`}
                  variant={i === currentIndex ? 'filled' : 'outlined'}
                  aria-pressed={i === currentIndex}
                  onClick={() => {
                    setAutoRotate(false);
                    setPageIndex(i);
                  }}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                />
              }
              label={
                <Typography sx={{ fontSize: 13, color: 'var(--fg-2)' }}>Rotate pages</Typography>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showOffline}
                  onChange={(e) => setShowOffline(e.target.checked)}
                />
              }
              label={
                <Typography sx={{ fontSize: 13, color: 'var(--fg-2)' }}>
                  Show offline badge
                </Typography>
              }
            />
          </Stack>
          <Typography sx={{ fontSize: 11, color: 'var(--fg-3)' }}>
            Live departures, layout, rows, filters, time zone and schedule match the display. Fonts
            are approximated. Changes here are not saved until you press Save.
          </Typography>
        </>
      )}
    </Stack>
  );
}
