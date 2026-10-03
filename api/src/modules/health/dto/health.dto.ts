import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ description: 'Liveness status', example: true })
  ok!: boolean;

  @ApiProperty({ description: 'Process uptime in seconds', example: 12.34 })
  uptime!: number;
}
