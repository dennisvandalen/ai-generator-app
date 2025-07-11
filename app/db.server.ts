import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema';

declare global {
  var __db: Database.Database | undefined;
}

let db: Database.Database;

if (process.env.NODE_ENV === 'production') {
  db = new Database(process.env.DATABASE_URL || './dev.sqlite');
} else {
  if (!global.__db) {
    global.__db = new Database('./dev.sqlite');
  }
  db = global.__db;
}

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

export const drizzleDb = drizzle(db, { schema });

export default drizzleDb;
