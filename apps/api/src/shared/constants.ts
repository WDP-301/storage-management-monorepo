export const ENV_KEY = {
  PORT: 'PORT',
  NODE_ENV: 'NODE_ENV',
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_USERNAME: 'DB_USERNAME',
  DB_PASSWORD: 'DB_PASSWORD',
  DB_DATABASE: 'DB_DATABASE',
  DB_SYNCHRONIZE: 'DB_SYNCHRONIZE',
  DB_LOGGING: 'DB_LOGGING',
  DB_SSL: 'DB_SSL',
  ENABLE_SWAGGER: 'ENABLE_SWAGGER',
  ENABLE_CORS: 'ENABLE_CORS',

  // Cookie-based auth sessions (opaque token, hashed in the `sessions` table)
  SESSION_COOKIE_NAME: 'SESSION_COOKIE_NAME',
  SESSION_TTL_MS: 'SESSION_TTL_MS',
  COOKIE_SECURE: 'COOKIE_SECURE',
  COOKIE_SAME_SITE: 'COOKIE_SAME_SITE',

  // S3-compatible object storage (e.g. Cloudflare R2)
  S3_ENDPOINT: 'S3_ENDPOINT',
  S3_REGION: 'S3_REGION',
  S3_ACCESS_KEY: 'S3_ACCESS_KEY',
  S3_SECRET_KEY: 'S3_SECRET_KEY',
  S3_BUCKET: 'S3_BUCKET',
  S3_FORCE_PATH_STYLE: 'S3_FORCE_PATH_STYLE',
  S3_PUBLIC_URL: 'S3_PUBLIC_URL',

  // Goong Maps API
  GOONG_API_KEY: 'GOONG_API_KEY',
} as const;

/** Goong REST API base URL */
export const GOONG_BASE_URL = 'https://rsapi.goong.io';

/** Default location bias for Goong autocomplete — Hồ Chí Minh City center */
export const GOONG_DEFAULT_LOCATION = '10.776889,106.700806';
