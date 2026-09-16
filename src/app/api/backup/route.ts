import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/authz";

/** Owner-only: downloads a consistent snapshot of the SQLite database. */
export async function GET() {
  await requireOwner();

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "taxi-backup-"));
  const file = path.join(directory, "taxi.db");
  try {
    await getDb().$client.backup(file);
    const bytes = await fs.readFile(file);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="taxi-backup-${stamp}.db"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
