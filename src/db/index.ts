import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "@/env";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const globalForDb = globalThis as unknown as { taxiDb?: Db };

/** Opens a SQLite database with the pragmas this app relies on. */
export function openDatabase(filename: string): Db {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  return drizzle({ client: sqlite, schema, casing: "snake_case" });
}

/** Applies pending SQL migrations from the `drizzle/` folder. */
export function migrateDatabase(db: Db): void {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

/**
 * Returns the shared database connection, opening it on first use.
 * Cached on `globalThis` so hot reloads in development reuse the connection.
 */
export function getDb(): Db {
  globalForDb.taxiDb ??= openDatabase(env().DATABASE_PATH);
  return globalForDb.taxiDb;
}

/** Test hook: replaces the shared connection (e.g. with an in-memory DB). */
export function setDbForTesting(db: Db): void {
  globalForDb.taxiDb = db;
}
