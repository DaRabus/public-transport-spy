import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL must be set for the TypeORM CLI');
}

// The TypeORM CLI requires exactly one exported DataSource.
const dataSource = new DataSource({
  type: 'postgres',
  url,
  entities: ALL_ENTITIES,
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: false
});

export default dataSource;
