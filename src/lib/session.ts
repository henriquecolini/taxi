import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "./auth";
import { isOwnerEmail, normalizeEmail } from "./access";

/** The signed-in person, as seen by the authorization layer. */
export interface Viewer {
  id: string;
  email: string;
  name: string;
  image: string | null;
  isOwner: boolean;
}

/** Resolves the current viewer from the session cookie (memoized per request). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return null;
  const { user } = session;
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    name: user.name,
    image: user.image ?? null,
    isOwner: isOwnerEmail(user.email),
  };
});
