import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { isEmailAllowed } from "./access";

export const ACCESS_DENIED_CODE = "ACCESS_DENIED";

const accessDenied = () =>
  APIError.from("FORBIDDEN", {
    code: ACCESS_DENIED_CODE,
    message: "This Google account has not been invited.",
  });

function createAuth() {
  const config = env();
  return betterAuth({
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
    // Google (OpenID Connect) is the only way in: no email/password accounts.
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
      },
    },
    onAPIError: { errorURL: "/login" },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh daily
    },
    databaseHooks: {
      user: {
        create: {
          // Never create accounts for strangers.
          before: async (user) => {
            if (!user.emailVerified || !isEmailAllowed(user.email)) throw accessDenied();
          },
        },
      },
      session: {
        create: {
          // Re-check on every sign-in so removed clients can't log back in.
          before: async (session) => {
            const [row] = getDb()
              .select({ email: schema.user.email, emailVerified: schema.user.emailVerified })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
              .all();
            if (!row?.emailVerified || !isEmailAllowed(row.email)) throw accessDenied();
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { taxiAuth?: Auth };

/** Lazily-created Better Auth instance (env is only read at runtime). */
export function getAuth(): Auth {
  globalForAuth.taxiAuth ??= createAuth();
  return globalForAuth.taxiAuth;
}
