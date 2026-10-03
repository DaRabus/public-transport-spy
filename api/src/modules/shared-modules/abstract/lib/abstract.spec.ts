import { getMetadataArgsStorage } from 'typeorm';
import { AbstractEntity, toAbstractDto } from './index';

describe('AbstractEntity', () => {
  it('uses a database-generated UUIDv7 primary key (PostgreSQL 18 uuidv7())', () => {
    const id = getMetadataArgsStorage().columns.find(
      (c) => c.target === AbstractEntity && c.propertyName === 'id'
    );
    expect(id?.options.primary).toBe(true);
    expect(id?.options.type).toBe('uuid');
    expect((id?.options.default as () => string)()).toBe('uuidv7()');
  });
});

describe('toAbstractDto', () => {
  it('maps the shared entity fields to their API representation', () => {
    const at = new Date('2026-10-06T10:00:00Z');
    expect(
      toAbstractDto({ id: '0199b4c2-0000-7000-8000-000000000001', createdAt: at, updatedAt: at })
    ).toEqual({
      id: '0199b4c2-0000-7000-8000-000000000001',
      createdAt: '2026-10-06T10:00:00.000Z',
      updatedAt: '2026-10-06T10:00:00.000Z'
    });
  });
});
