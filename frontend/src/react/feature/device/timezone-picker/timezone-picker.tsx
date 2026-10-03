'use client';

import useSWR from 'swr';
import { Autocomplete, TextField } from '@mui/material';

const fetchTimezones = async (url: string): Promise<string[]> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load time zones');
  return ((await res.json()) as { data: string[] }).data;
};

/** Current UTC offset of a zone, e.g. "UTC+02:00" (DST-aware, computed by the browser). */
function utcOffset(zone: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value;
  return !name || name === 'GMT' ? 'UTC+00:00' : name.replace('GMT', 'UTC');
}

/** Picks one of the time zones the API supports (it converts them for the display's firmware). */
export function TimezonePicker({
  value,
  onChange
}: {
  value: string;
  onChange: (zone: string) => void;
}) {
  const { data: zones = [value], isLoading } = useSWR('/api/v1/devices/timezones', fetchTimezones);

  return (
    <Autocomplete
      options={zones}
      value={value}
      loading={isLoading}
      disableClearable
      onChange={(_e, zone) => onChange(zone)}
      groupBy={(zone) => zone.split('/')[0]}
      getOptionLabel={(zone) => `${zone.replace(/_/g, ' ')} (${utcOffset(zone)})`}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Time zone"
          helperText="Clock, countdowns and the on/off schedule use this zone"
        />
      )}
    />
  );
}
