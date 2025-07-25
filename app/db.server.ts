import fs from 'fs';
import path from 'path';
import * as schema from './db/schema';
// Import both database drivers
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import {drizzle as drizzleTurso} from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
let drizzleDb: BetterSQLite3Database<typeof schema> | LibSQLDatabase<typeof schema>;

// Determine the environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_ENV = process.env.APP_ENV || (NODE_ENV === 'production' ? 'production' : 'development');

console.log('Initializing database connection...');
console.log('NODE_ENV:', NODE_ENV);
console.log('APP_ENV:', APP_ENV);

if (APP_ENV === 'production' || APP_ENV === 'staging') {
  // Use Turso in production and staging
  const envPrefix = APP_ENV === 'staging' ? 'STAGING_' : '';
  const tursoUrl = process.env[`${envPrefix}TURSO_CONNECTION_URL`] ||
                   process.env[`${envPrefix}TURSO_DATABASE_URL`];
  const tursoAuthToken = process.env[`${envPrefix}TURSO_AUTH_TOKEN`];

  console.log(`${APP_ENV.charAt(0).toUpperCase() + APP_ENV.slice(1)} Turso URL:`, tursoUrl || 'Not set');
  console.log(`${APP_ENV.charAt(0).toUpperCase() + APP_ENV.slice(1)} Turso Auth Token:`, tursoAuthToken ? 'Set' : 'Not set');

  if (!tursoUrl) {
    console.error(`Error: ${envPrefix}TURSO_CONNECTION_URL or ${envPrefix}TURSO_DATABASE_URL must be set in ${APP_ENV}`);
    // Continue with a fallback to avoid crashing, but log the error
  }

  const client = createClient({
    url: tursoUrl!,
    authToken: tursoAuthToken!,
  });

  drizzleDb = drizzleTurso(client, { schema });
  console.log(`Connected to Turso database (${APP_ENV})`);
} else {
  // Use SQLite in development
  const dbPath = './dev.sqlite';
  console.log('SQLite database path:', dbPath);

  // Ensure the directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  drizzleDb = drizzleSqlite(db, { schema });
  console.log('Connected to SQLite database');
}

export default drizzleDb;
