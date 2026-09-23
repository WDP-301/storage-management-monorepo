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
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, 'modules/**/*.entity.js')],
  migrations: [join(__dirname, 'migrations/*.js')],
});
