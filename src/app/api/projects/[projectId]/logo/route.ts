import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireProjectAccess } from "@/lib/authz";

/** Serves a project logo to viewers with access to the project. */
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/logo">) {
  const { project } = await requireProjectAccess((await params).projectId);
  const row = getDb()
    .select({ logo: projects.logo, logoMime: projects.logoMime })
    .from(projects)
    .where(eq(projects.id, project.id))
    .get();

  if (!row?.logo || !row.logoMime) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(row.logo), {
    headers: {
      "Content-Type": row.logoMime,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      // URLs are versioned (`?v=`), so the browser may keep it; never shared caches.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
