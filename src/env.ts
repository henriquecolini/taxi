import "server-only";
import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Values are validated lazily on first access, so `next build` (which runs
 * without secrets, e.g. inside the Docker build stage) never fails on a
 * missing variable. At runtime a misconfiguration fails loudly on the first
 * request instead of silently misbehaving.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /** Absolute or relative path of the SQLite database file. */
  DATABASE_PATH: z.string().min(1).default("./data/taxi.db"),

  /** Public base URL of the app, e.g. https://taxi.colini.dev */
  BETTER_AUTH_URL: z.url(),
  /** Random secret (>= 32 chars) used to sign sessions. */
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  /** Google account email of the single owner (the freelancer). */
  OWNER_EMAIL: z.email().transform((email) => email.toLowerCase()),

  /** IANA timezone used for days, weeks and invoice dates. */
  TIMEZONE: z
    .string()
    .default("America/Sao_Paulo")
    .refine(isValidTimeZone, "Invalid IANA timezone"),

  GITLAB_URL: z.url().default("https://gitlab.com"),
  /** Personal access token with the `read_api` scope. Optional. */
  GITLAB_TOKEN: z.string().optional(),
  /** Comma-separated commit author emails to include. Empty = all authors. */
  GITLAB_AUTHOR_EMAILS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),

  /** Anthropic API key used for AI summaries. Optional. */
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
});

export type Env = z.infer<typeof schema>;

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isGitLabConfigured = () => Boolean(env().GITLAB_TOKEN);
export const isAiConfigured = () => Boolean(env().ANTHROPIC_API_KEY);
