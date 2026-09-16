/** Runs once when the server starts: applies pending database migrations. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb, migrateDatabase } = await import("./db");
  migrateDatabase(getDb());
}
