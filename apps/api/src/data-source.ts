import { join } from 'node:path';
import { DataSource } from 'typeorm';

// Loads apps/api/.env when run via `pnpm --filter @storage/api migration:*` (Node 20.12+)
try {
  process.loadEnvFile?.();
} catch {
  // .env is optional — real environment variables still apply
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgrespassword',
  database: process.env.DB_DATABASE ?? 'storage_management_db',
  entities: [join(__dirname, 'modules/**/*.entity.js')],
  migrations: [join(__dirname, 'migrations/*.js')],
});
