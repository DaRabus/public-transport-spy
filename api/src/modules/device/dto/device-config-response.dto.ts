import { ApiProperty } from '@nestjs/swagger';
import { THEMES, type Theme } from '../screens/screen-composer';

export class DeviceConfigResponseDto {
  @ApiProperty({ description: 'Station name to display departures for', example: 'Zürich HB' })
  stationName!: string;

  @ApiProperty({
    description: 'POSIX TZ string for ESP32 configTzTime (converted from the device IANA zone)',
    example: 'CET-1CEST,M3.5.0,M10.5.0/3'
  })
  timezone!: string;

  @ApiProperty({
    description: 'Display theme (standard | retro | bold)',
    example: 'standard',
    enum: THEMES
  })
  theme!: Theme;

  @ApiProperty({ description: 'Transit data fetch interval in milliseconds', example: 300000 })
  apiInterval!: number;

  @ApiProperty({ description: 'Screen refresh interval in milliseconds', example: 15000 })
  screenInterval!: number;

  @ApiProperty({ description: 'Telemetry metrics interval in milliseconds', example: 600000 })
  metricsInterval!: number;

  @ApiProperty({
    description: 'Secret authentication token assigned to this device',
    example: 'a1b2c3d4e5f678901234567890abcdef',
    required: false
  })
  deviceToken?: string;

  @ApiProperty({
    description: 'Whether the device is paired with a user / configured',
    example: false
  })
  isPaired!: boolean;

  @ApiProperty({
    description: 'Short 6-character pairing code if unpaired',
    example: 'KV79P2',
    required: false
  })
  pairingCode?: string;

  @ApiProperty({
    description: 'Absolute pairing URL for QR code generation',
    example: 'https://app.example.com/pair?code=KV79P2',
    required: false
  })
  pairingUrl?: string;

  @ApiProperty({
    description:
      'If present, the device switches to this API base URL (after verifying it answers)',
    example: 'https://api.example.com',
    required: false
  })
  backendBaseUrl?: string;

  @ApiProperty({
    description:
      'On/off window when scheduleEnabled: minutes after local midnight (off may be past midnight) and weekday bits (bit 0 = Sunday). Absent = always on.',
    example: { on: 360, off: 1380, days: 127 },
    required: false
  })
  schedule?: { on: number; off: number; days: number };
}
