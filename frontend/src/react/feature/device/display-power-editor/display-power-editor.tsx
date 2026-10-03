'use client';

import {
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';

export interface DisplayPower {
  /** false = display switched off (device blanks its panel) */
  isConfigured: boolean;
  scheduleEnabled: boolean;
  /** minutes after local midnight */
  scheduleOn: number;
  scheduleOff: number;
  /** weekday bits, bit 0 = Sunday ... bit 6 = Saturday */
  scheduleDays: number;
}

// Shown Monday-first; values are the firmware's weekday bit positions (0 = Sunday).
const WEEKDAYS = [
  { bit: 1, label: 'Mo' },
  { bit: 2, label: 'Tu' },
  { bit: 3, label: 'We' },
  { bit: 4, label: 'Th' },
  { bit: 5, label: 'Fr' },
  { bit: 6, label: 'Sa' },
  { bit: 0, label: 'Su' }
];

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const fromTime = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** Display on/off and an optional daily window, e.g. on 06:00-23:00 on weekdays. */
export function DisplayPowerEditor({
  value,
  onChange
}: {
  value: DisplayPower;
  onChange: (patch: Partial<DisplayPower>) => void;
}) {
  const days = WEEKDAYS.filter((d) => (value.scheduleDays >> d.bit) & 1).map((d) => d.bit);
  const overnight = value.scheduleOff < value.scheduleOn;

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={value.isConfigured}
            onChange={(e) => onChange({ isConfigured: e.target.checked })}
          />
        }
        label={value.isConfigured ? 'Display on' : 'Display switched off (screen stays dark)'}
      />

      <FormControlLabel
        disabled={!value.isConfigured}
        control={
          <Switch
            checked={value.scheduleEnabled}
            onChange={(e) => onChange({ scheduleEnabled: e.target.checked })}
          />
        }
        label="Only on during these times"
      />

      {value.isConfigured && value.scheduleEnabled && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              type="time"
              label="On from"
              value={toTime(value.scheduleOn)}
              onChange={(e) => {
                const minutes = fromTime(e.target.value);
                if (minutes !== null) onChange({ scheduleOn: minutes });
              }}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
            />
            <TextField
              type="time"
              label="Off at"
              value={toTime(value.scheduleOff)}
              onChange={(e) => {
                const minutes = fromTime(e.target.value);
                if (minutes !== null) onChange({ scheduleOff: minutes });
              }}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
            />
          </Stack>
          <ToggleButtonGroup
            size="small"
            value={days}
            aria-label="Weekdays"
            onChange={(_e, selected: number[]) => {
              // At least one day: an empty set would mean "never on", which is what the main switch is for.
              if (selected.length)
                onChange({ scheduleDays: selected.reduce((bits, bit) => bits | (1 << bit), 0) });
            }}
          >
            {WEEKDAYS.map((d) => (
              <ToggleButton key={d.bit} value={d.bit} aria-label={d.label}>
                {d.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="body2" sx={{ color: 'var(--fg-3)' }}>
            {value.scheduleOn === value.scheduleOff
              ? 'On all day on the selected days.'
              : overnight
                ? `On from ${toTime(value.scheduleOn)} until ${toTime(value.scheduleOff)} the next morning, starting on the selected days.`
                : `On from ${toTime(value.scheduleOn)} to ${toTime(value.scheduleOff)} on the selected days.`}{' '}
            Outside this window the screen is dark.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
