import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransitDepartureDto {
  @ApiProperty({ description: 'Unix epoch timestamp in seconds', example: 1717200000 })
  timestamp!: number;

  @ApiProperty({ description: 'Line identifier (e.g. S2, IR 36, IC 1, Bus 32)', example: 'S2' })
  line!: string;

  @ApiProperty({ description: 'Destination station', example: 'Zürich Flughafen' })
  destination!: string;

  @ApiPropertyOptional({ description: 'Transport category (S, IR, IC, B, T, ...)', example: 'S' })
  category?: string;

  @ApiPropertyOptional({ description: 'Departure platform/track', example: '31', nullable: true })
  platform?: string | null;

  @ApiPropertyOptional({
    description: 'Current delay in minutes (already included in timestamp)',
    example: 3
  })
  delayMinutes?: number;
}

export class TransitStationboardResponseDto {
  @ApiProperty({ description: 'Station name', example: 'Zürich HB' })
  station!: string;

  @ApiProperty({ description: 'List of next departures', type: [TransitDepartureDto] })
  departures!: TransitDepartureDto[];
}

export class StationLocationDto {
  @ApiProperty({ description: 'Station ID', example: '8503000' })
  id!: string;

  @ApiProperty({ description: 'Station name', example: 'Zürich HB' })
  name!: string;

  @ApiProperty({ description: 'Latitude', example: 47.377847, nullable: true })
  latitude!: number | null;

  @ApiProperty({ description: 'Longitude', example: 8.540502, nullable: true })
  longitude!: number | null;
}
