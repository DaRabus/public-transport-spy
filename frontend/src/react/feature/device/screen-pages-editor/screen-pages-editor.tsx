'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { DisplayPage } from '@helpers/types';

/** Mirrors the API limit (MAX_PAGES in screen-composer.ts). */
const MAX_SCREEN_PAGES = 6;

const PAGE_TYPES: Array<{ value: DisplayPage['type']; label: string }> = [
  { value: 'departures', label: 'Departures' },
  { value: 'clock', label: 'Big clock' },
  { value: 'message', label: 'Message' }
];

/** Drops empty inputs so the API only receives fields the owner actually set. */
export function cleanPages(pages: DisplayPage[]): DisplayPage[] {
  return pages.map((page) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(page)) {
      if (value === '' || value === undefined || (typeof value === 'number' && Number.isNaN(value)))
        continue;
      if (Array.isArray(value) && value.length === 0) continue;
      clean[key] = typeof value === 'string' && key !== 'text' ? value.trim() : value;
    }
    return clean as unknown as DisplayPage;
  });
}

const toNumber = (raw: string) => (raw === '' ? undefined : Number(raw));

/** Small heading for a group of related fields inside a page card. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: 'block',
        color: 'var(--fg-3)',
        letterSpacing: '0.1em',
        lineHeight: 1.5,
        mb: 1.5
      }}
    >
      {children}
    </Typography>
  );
}

/** Rows of fields: stacked on phones, side by side from `sm`; top-aligned so helper texts don't shift neighbours. */
const fieldRowSx = { alignItems: 'flex-start' } as const;

/** Comma-separated list input that commits on blur, so typing "S2, " isn't swallowed mid-entry. */
function ListField({
  label,
  helperText,
  value,
  onCommit
}: {
  label: string;
  helperText?: string;
  value?: string[];
  onCommit: (items: string[] | undefined) => void;
}) {
  const [text, setText] = useState((value ?? []).join(', '));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText((value ?? []).join(', '));
  }, [value]);

  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      helperText={helperText}
      value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const items = text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        onCommit(items.length ? items : undefined);
        setText(items.join(', '));
      }}
    />
  );
}

export function ScreenPagesEditor({
  pages,
  onChange,
  defaultStation
}: {
  pages: DisplayPage[];
  onChange: (pages: DisplayPage[]) => void;
  defaultStation: string;
}) {
  const update = (index: number, patch: Partial<DisplayPage>) =>
    onChange(pages.map((page, i) => (i === index ? { ...page, ...patch } : page)));
  const move = (index: number, delta: number) => {
    const next = [...pages];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  return (
    <Stack spacing={3}>
      {pages.map((page, i) => (
        <Box key={i} sx={{ border: '1px solid var(--line)', borderRadius: 2, p: { xs: 2, sm: 3 } }}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', flexWrap: 'wrap', columnGap: 1.5, rowGap: 1.5, mb: 3 }}
          >
            <Typography sx={{ color: 'var(--fg)', fontWeight: 600, minWidth: 60 }}>
              Page {i + 1}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={page.type}
                onChange={(e) => update(i, { type: e.target.value as DisplayPage['type'] })}
              >
                {PAGE_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="Seconds"
              sx={{ width: 100 }}
              slotProps={{ htmlInput: { min: 3, max: 300 } }}
              value={page.durationSec ?? ''}
              placeholder={page.type === 'departures' ? '15' : '8'}
              onChange={(e) => update(i, { durationSec: toNumber(e.target.value) })}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={0.5}>
              <IconButton aria-label="Move page up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Move page down"
                disabled={i === pages.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Remove page"
                disabled={pages.length === 1}
                onClick={() => onChange(pages.filter((_, j) => j !== i))}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {page.type === 'departures' && (
            <Stack spacing={3}>
              <Box>
                <GroupLabel>Header</GroupLabel>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={fieldRowSx}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Station"
                    placeholder={defaultStation}
                    helperText="Empty = the display's station"
                    value={page.station ?? ''}
                    onChange={(e) => update(i, { station: e.target.value })}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Header text"
                    placeholder="Station name"
                    helperText="Replaces the station name in the header"
                    slotProps={{ htmlInput: { maxLength: 40 } }}
                    value={page.title ?? ''}
                    onChange={(e) => update(i, { title: e.target.value })}
                  />
                </Stack>
              </Box>

              <Box>
                <GroupLabel>Layout</GroupLabel>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={fieldRowSx}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Rows</InputLabel>
                      <Select
                        label="Rows"
                        value={page.rows ?? 3}
                        onChange={(e) => update(i, { rows: Number(e.target.value) })}
                      >
                        <MenuItem value={1}>1 (large)</MenuItem>
                        <MenuItem value={2}>2</MenuItem>
                        <MenuItem value={3}>3</MenuItem>
                        <MenuItem value={4}>4 (compact)</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Time</InputLabel>
                      <Select
                        label="Time"
                        value={page.timeFormat ?? 'countdown'}
                        onChange={(e) =>
                          update(i, { timeFormat: e.target.value as DisplayPage['timeFormat'] })
                        }
                      >
                        <MenuItem value="countdown">Minutes left (7&apos;)</MenuItem>
                        <MenuItem value="clock">Departure time (14:32)</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      label="Walking time (min)"
                      helperText="Hides departures you can't catch"
                      slotProps={{ htmlInput: { min: 0, max: 60 } }}
                      value={page.walkMinutes ?? ''}
                      onChange={(e) => update(i, { walkMinutes: toNumber(e.target.value) })}
                    />
                  </Stack>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 3 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!page.showPlatform}
                          onChange={(e) => update(i, { showPlatform: e.target.checked })}
                        />
                      }
                      label="Platform"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!page.showDelay}
                          onChange={(e) => update(i, { showDelay: e.target.checked })}
                        />
                      }
                      label="Delay"
                    />
                  </Stack>
                </Stack>
              </Box>

              <Box>
                <GroupLabel>Filters</GroupLabel>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={fieldRowSx}>
                    <ListField
                      label="Only lines"
                      helperText="e.g. S2, IR 36"
                      value={page.lines}
                      onCommit={(lines) => update(i, { lines })}
                    />
                    <ListField
                      label="Hide lines"
                      helperText="e.g. S12"
                      value={page.excludeLines}
                      onCommit={(excludeLines) => update(i, { excludeLines })}
                    />
                    <ListField
                      label="Only types"
                      helperText="S, IR, IC, B (bus), T (tram)"
                      value={page.categories}
                      onCommit={(categories) => update(i, { categories })}
                    />
                  </Stack>
                  <TextField
                    size="small"
                    fullWidth
                    label="Only destinations containing"
                    placeholder="e.g. Flughafen"
                    value={page.destinationContains ?? ''}
                    onChange={(e) => update(i, { destinationContains: e.target.value })}
                  />
                </Stack>
              </Box>
            </Stack>
          )}

          {page.type === 'clock' && (
            <FormControlLabel
              control={
                <Switch
                  checked={!!page.showDate}
                  onChange={(e) => update(i, { showDate: e.target.checked })}
                />
              }
              label="Show date"
            />
          )}

          {page.type === 'message' && (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              label="Message"
              helperText="Up to 3 lines, 120 characters"
              slotProps={{ htmlInput: { maxLength: 120 } }}
              value={page.text ?? ''}
              onChange={(e) => update(i, { text: e.target.value })}
            />
          )}
        </Box>
      ))}

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        disabled={pages.length >= MAX_SCREEN_PAGES}
        onClick={() => onChange([...pages, { type: 'departures' }])}
      >
        Add page ({pages.length}/{MAX_SCREEN_PAGES})
      </Button>
    </Stack>
  );
}
