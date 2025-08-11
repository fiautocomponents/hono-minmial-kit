import { Migrator } from '@mikro-orm/migrations'
import { PostgreSqlDriver } from '@mikro-orm/postgresql'
import type { Options } from '@mikro-orm/postgresql'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'
import { SeedManager } from '@mikro-orm/seeder'

const config: Options = {
  entities: ['./dist/entities'],
  entitiesTs: ['./src/entities'],
  seeder: {
    path: './dist/seeders',
    pathTs: './src/seeders',
  },
  migrations: {
    path: './dist/migrations',
    pathTs: './src/migrations',
  },
  baseDir: process.cwd(),
  dbName: process.env.MIKRO_ORM_DB_NAME || 'default-db',
  user: process.env.MIKRO_ORM_USER || 'postgres',
  password: process.env.MIKRO_ORM_PASSWORD || 'pass222',
  host: process.env.MIKRO_ORM_HOST || 'localhost',
  port: parseInt(process.env.MIKRO_ORM_PORT || '5432') || 5432,
  debug: process.env.NODE_ENV !== 'production',
  driver: PostgreSqlDriver,
  metadataProvider: TsMorphMetadataProvider,
  extensions: [Migrator, SeedManager],
}

export default config
