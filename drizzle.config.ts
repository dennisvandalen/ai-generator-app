import type { Config } from 'drizzle-kit';

// Determine the environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_ENV = process.env.APP_ENV || (NODE_ENV === 'production' ? 'production' : 'development');

console.log('Drizzle configuration for environment:', APP_ENV);

// For development, use SQLite
const devConfig = {
  dialect: 'sqlite',
  schema: './app/db/schema.ts',
  out: './app/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:./dev.sqlite',
  },
  verbose: true,
  strict: true,
} satisfies Config;

// For staging, use Turso with staging credentials
const stagingConfig = {
  dialect: 'turso',
  schema: './app/db/schema.ts',
  out: './app/db/migrations',
  dbCredentials: {
    url: process.env.STAGING_TURSO_CONNECTION_URL || process.env.STAGING_TURSO_DATABASE_URL || '',
    authToken: process.env.STAGING_TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
} satisfies Config;

// For production, use Turso
const prodConfig = {
  dialect: 'turso',
  schema: './app/db/schema.ts',
  out: './app/db/migrations',
  dbCredentials: {
    url: process.env.TURSO_CONNECTION_URL || process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
} satisfies Config;

// Select the appropriate configuration based on the environment
let config;
if (APP_ENV === 'production') {
  config = prodConfig;
} else if (APP_ENV === 'staging') {
  config = stagingConfig;
} else {
  config = devConfig;
}

export default config;
