import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  Matches,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { MAX_PAGES, THEMES, type Theme } from '../screens/screen-composer';

/** One page of the owner's display profile. Fields that don't belong to the page's type are ignored. */
export class DisplayPageDto {
  @ApiProperty({ enum: ['departures', 'clock', 'message'], example: 'departures' })
  @IsIn(['departures', 'clock', 'message'])
  type!: 'departures' | 'clock' | 'message';

  @ApiPropertyOptional({ description: 'Seconds this page stays on screen (3-300)', example: 15 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(300)
  durationSec?: number;

  @ApiPropertyOptional({
    description: 'departures: station (defaults to the device station)',
    example: 'Bern'
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  station?: string;

  @ApiPropertyOptional({ description: 'departures: custom header text', example: 'To the airport' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  title?: string;

  @ApiPropertyOptional({ description: 'departures: visible rows (1-4)', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  rows?: number;

  @ApiPropertyOptional({ enum: ['countdown', 'clock'], description: "departures: 7' vs 14:32" })
  @IsOptional()
  @IsIn(['countdown', 'clock'])
  timeFormat?: 'countdown' | 'clock';

  @ApiPropertyOptional({ description: 'departures: show the platform column' })
  @IsOptional()
  @IsBoolean()
  showPlatform?: boolean;

  @ApiPropertyOptional({ description: 'departures: show the delay column (+3)' })
  @IsOptional()
  @IsBoolean()
  showDelay?: boolean;

  @ApiPropertyOptional({
    description: 'departures: only these lines (spaces/case ignored)',
    example: ['S2', 'IR 36']
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  lines?: string[];

  @ApiPropertyOptional({ description: 'departures: hide these lines', example: ['S12'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  excludeLines?: string[];

  @ApiPropertyOptional({
    description: 'departures: only these categories (S, IR, IC, B, T, ...)',
    example: ['S', 'T']
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(8, { each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'departures: only destinations containing this text',
    example: 'Flughafen'
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  destinationContains?: string;

  @ApiPropertyOptional({
    description: "departures: hide departures you can't catch (0-60 min)",
    example: 4
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  walkMinutes?: number;

  @ApiPropertyOptional({ description: 'clock: show the date below the time' })
  @IsOptional()
  @IsBoolean()
  showDate?: boolean;

  @ApiPropertyOptional({
    description: 'message: up to 3 lines separated by \\n',
    example: 'Gone fishing\nBack Monday'
  })
  // Required on message pages; type-checked whenever present on any page so nothing arbitrary can be
  // stored in the jsonb column. (Several @ValidateIf on one property skip it if ANY is false.)
  @ValidateIf((page: DisplayPageDto) => page.type === 'message' || page.text !== undefined)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/, { message: 'text must contain visible characters' })
  text?: string;
}

export class DisplayProfileDto {
  @ApiProperty({ type: [DisplayPageDto], description: `1-${MAX_PAGES} pages, shown in rotation` })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PAGES)
  @ValidateNested({ each: true })
  @Type(() => DisplayPageDto)
  pages!: DisplayPageDto[];
}

export class ScreensResponseDto {
  @ApiProperty({
    description:
      'Pages of positioned widgets (text, clock, line, list, status) rendered by the firmware. See docs/api-reference.md §2.2a.',
    type: 'array',
    items: { type: 'object' }
  })
  pages!: unknown[];
}

/** Unsaved settings from the web app's form, composed for the live preview. Omitted fields use the stored ones. */
export class PreviewScreensDto {
  @ApiPropertyOptional({ type: DisplayProfileDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DisplayProfileDto)
  display?: DisplayProfileDto | null;

  @ApiPropertyOptional({ example: 'Bern' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  stationName?: string;

  @ApiPropertyOptional({ enum: THEMES })
  @IsOptional()
  @IsIn(THEMES)
  theme?: Theme;
}
