import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { THEMES, type Theme } from '../screens/screen-composer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { DisplayProfileDto } from './display-profile.dto';
import { AbstractDto } from '../../shared-modules/abstract/lib';
import { TIMEZONE_IDS } from '../timezones/timezones';

export class UpdateDeviceDto {
  @ApiPropertyOptional({ example: 'Kitchen Departure Display' })
  @IsString()
  @IsOptional()
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional({ example: 'Bern' })
  @IsString()
  @IsOptional()
  @MaxLength(128)
  stationName?: string;

  @ApiPropertyOptional({
    description: 'IANA time zone (one of the supported zones)',
    example: 'Europe/Zurich',
    enum: TIMEZONE_IDS
  })
  @IsOptional()
  @IsIn(TIMEZONE_IDS, { message: 'timezone must be a supported IANA time zone' })
  timezone?: string;

  @ApiPropertyOptional({ enum: THEMES, example: 'retro' })
  @IsString()
  @IsOptional()
  @IsIn(THEMES)
  theme?: Theme;

  @ApiPropertyOptional({ example: 120000 })
  @IsInt()
  @IsOptional()
  @Min(30000)
  @Max(3600000)
  apiInterval?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsInt()
  @IsOptional()
  @Min(1000)
  @Max(60000)
  screenInterval?: number;

  @ApiPropertyOptional({ example: 300000 })
  @IsInt()
  @IsOptional()
  @Min(60000)
  @Max(86400000)
  metricsInterval?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isConfigured?: boolean;

  @ApiPropertyOptional({ description: 'Turn the display on only during the schedule window' })
  @IsBoolean()
  @IsOptional()
  scheduleEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Switch-on time, minutes after local midnight (0-1439)',
    example: 360
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(1439)
  scheduleOn?: number;

  @ApiPropertyOptional({
    description: 'Switch-off time, minutes after local midnight (0-1439); may be past midnight',
    example: 1380
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(1439)
  scheduleOff?: number;

  @ApiPropertyOptional({
    description: 'Weekdays the window starts on, bit 0 = Sunday ... bit 6 = Saturday (1-127)',
    example: 62
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(127)
  scheduleDays?: number;

  @ApiPropertyOptional({
    type: DisplayProfileDto,
    nullable: true,
    description: 'Screen pages; null resets to the default board'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DisplayProfileDto)
  display?: DisplayProfileDto | null;
}

export class DeviceDetailDto extends AbstractDto {
  @ApiProperty({
    nullable: true,
    description:
      'Hardware UUID once claimed by a physical device; null while awaiting hardware pairing'
  })
  deviceUuid!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  stationName!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  theme!: Theme;

  @ApiProperty()
  apiInterval!: number;

  @ApiProperty()
  screenInterval!: number;

  @ApiProperty()
  metricsInterval!: number;

  @ApiProperty()
  isConfigured!: boolean;

  @ApiProperty()
  scheduleEnabled!: boolean;

  @ApiProperty()
  scheduleOn!: number;

  @ApiProperty()
  scheduleOff!: number;

  @ApiProperty()
  scheduleDays!: number;

  @ApiProperty({ nullable: true })
  lastSeenAt!: string | null;

  @ApiProperty({ nullable: true })
  lastIp!: string | null;

  @ApiProperty()
  isPaired!: boolean;

  @ApiProperty({ nullable: true })
  pairingCode!: string | null;

  @ApiProperty({ nullable: true })
  claimedAt!: string | null;

  @ApiProperty({ nullable: true })
  userId!: string | null;

  @ApiProperty({ type: DisplayProfileDto, nullable: true })
  display!: DisplayProfileDto | null;
}

export class TransferDeviceDto {
  @ApiProperty({ description: 'Username of the account that receives the display', example: 'bob' })
  @IsString()
  @MaxLength(128)
  toUserName!: string;

  @ApiProperty({
    description: 'Current owner (checked by the API, filled in by the BFF from the session)',
    example: 'alice'
  })
  @IsString()
  @MaxLength(128)
  fromUserName!: string;
}
