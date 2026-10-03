import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbstractDto } from '../../shared-modules/abstract/lib';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

/** Largest value of a Postgres `integer` column. */
const INT4_MAX = 2_147_483_647;

export class DeviceMetricsInputDto {
  @ApiProperty({
    description: 'Device hardware UUID',
    example: 'd3b07384-d113-3660-84cf-3b999cd46903'
  })
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ApiProperty({ description: 'Station name currently loaded on device', example: 'Zürich HB' })
  @IsString()
  @IsNotEmpty()
  stationName!: string;

  @ApiProperty({ description: 'Device uptime in seconds', example: 120 })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  uptimeSeconds!: number;

  @ApiProperty({ description: 'ESP32 reset reason code', example: 1 })
  @IsNumber()
  resetReason!: number;

  @ApiProperty({ description: 'CPU frequency in MHz', example: 240 })
  @IsNumber()
  cpuFreqMHz!: number;

  @ApiProperty({ description: 'Free RAM in bytes', example: 180000 })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  ramFreeBytes!: number;

  @ApiProperty({ description: 'Total heap size in bytes', example: 320000 })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  ramTotalBytes!: number;

  @ApiProperty({ description: 'Minimum free heap ever reached in bytes', example: 160000 })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  ramMinFreeEver!: number;

  @ApiProperty({ description: 'Largest allocatable block in bytes', example: 95000 })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  ramMaxAllocBlock!: number;

  @ApiProperty({ description: 'Total LittleFS storage size in bytes', example: 1500000 })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  fsTotalBytes!: number;

  @ApiProperty({ description: 'Used LittleFS storage size in bytes', example: 45000 })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  fsUsedBytes!: number;

  @ApiProperty({ description: 'WiFi RSSI signal strength in dBm', example: -65 })
  @IsNumber()
  wifiSignalRssi!: number;

  @ApiPropertyOptional({ description: 'Connected WiFi BSSID', example: 'aa:bb:cc:dd:ee:ff' })
  @IsString()
  @IsOptional()
  wifiBssid?: string;

  @ApiProperty({ description: 'Connected WiFi channel', example: 6 })
  @IsNumber()
  wifiChannel!: number;

  @ApiPropertyOptional({ description: 'Firmware version reported by the device', example: '1.0.0' })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  firmwareVersion?: string;
}

export class DeviceMetricsAckDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}

/** Response shape of a stored telemetry snapshot (GET /v1/devices/:uuid/metrics). */
export class DeviceMetricDto extends AbstractDto {
  @ApiProperty({ format: 'uuid', description: 'Internal id of the device row' })
  deviceId!: string;

  @ApiProperty() stationName!: string;
  @ApiProperty() uptimeSeconds!: number;
  @ApiProperty() resetReason!: number;
  @ApiProperty() cpuFreqMHz!: number;
  @ApiProperty() ramFreeBytes!: number;
  @ApiProperty() ramTotalBytes!: number;
  @ApiProperty() ramMinFreeEver!: number;
  @ApiProperty() ramMaxAllocBlock!: number;
  @ApiProperty() fsTotalBytes!: number;
  @ApiProperty() fsUsedBytes!: number;
  @ApiProperty() wifiSignalRssi!: number;
  @ApiProperty({ nullable: true }) wifiBssid!: string | null;
  @ApiProperty() wifiChannel!: number;
  @ApiProperty({ nullable: true }) firmwareVersion!: string | null;
}
