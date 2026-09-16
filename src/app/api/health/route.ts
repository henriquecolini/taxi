import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/** Liveness probe for Docker/Coolify: the server is up and the database answers. */
export function GET() {
  getDb().run(sql`SELECT 1`);
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
