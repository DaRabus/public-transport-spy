import { ApiProperty } from '@nestjs/swagger';
import type { AbstractEntity } from './abstract.entity';

/** Base for every response DTO: the AbstractEntity fields in their API form. */
export abstract class AbstractDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUIDv7 primary key',
    example: '0199b4c2-6f1a-7c3e-9a51-2b7d4e8f0a13'
  })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Entity -> DTO for the shared fields; every toXxxDto() mapper spreads this. */
export function toAbstractDto(entity: AbstractEntity): AbstractDto {
  const now = new Date().toISOString();
  return {
    id: entity.id!,
    createdAt: entity.createdAt?.toISOString() ?? now,
    updatedAt: entity.updatedAt?.toISOString() ?? now
  };
}
