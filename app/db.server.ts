import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema';

let db: Database.Database;

if (process.env.NODE_ENV === 'production') {
  db = new Database(process.env.DATABASE_URL || './dev.sqlite');
} else {
  db = new Database('./dev.sqlite');
}

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

export const drizzleDb = drizzle(db, { schema });

export default drizzleDb;
