import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizePairingCode, PAIRING_CODE_MESSAGE, PAIRING_CODE_PATTERN } from '../pairing-code';

export class PairDeviceDto {
  @ApiProperty({
    description: '6-character pairing code shown on device OLED display (spaces/dashes ignored)',
    example: 'KV79P2'
  })
  @Transform(({ value }) => normalizePairingCode(value))
  @Matches(PAIRING_CODE_PATTERN, { message: PAIRING_CODE_MESSAGE })
  pairingCode!: string;

  @ApiPropertyOptional({
    description: 'Friendly name for the device',
    example: 'Living Room Clock'
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional({
    description: 'Station name to display departures for (defaults to Zürich HB)',
    example: 'Bern'
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  stationName?: string;

  @ApiProperty({
    description:
      'Username of the account claiming the device. Set by the web backend from the authenticated session, never from client input.',
    example: 'johndoe'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userId!: string;
}
