/**
 * Database schema.
 *
 * Conventions:
 * - TypeScript keys are camelCase; SQL columns are snake_case (see `casing`
 *   in `src/db/index.ts` and `drizzle.config.ts`).
 * - Instants are stored as Unix epoch milliseconds (`integer`).
 * - Calendar dates (invoice dates, week starts) are `YYYY-MM-DD` strings,
 *   interpreted in the app timezone (`TIMEZONE`).
 * - Money is stored as integer cents (hundredths of the project currency).
 */
import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

/* -------------------------------------------------------------------------- */
/* Better Auth tables                                                         */
/* -------------------------------------------------------------------------- */

export const user = sqliteTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: "boolean" }).notNull().default(false),
  image: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    token: text().notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* -------------------------------------------------------------------------- */
/* Application tables                                                         */
/* -------------------------------------------------------------------------- */

export const AI_LOCALES = ["en", "pt-BR"] as const;
export type AiLocale = (typeof AI_LOCALES)[number];

export const projects = sqliteTable("projects", {
  id: id(),
  name: text().notNull(),
  clientName: text().notNull().default(""),
  description: text().notNull().default(""),
  logo: blob({ mode: "buffer" }),
  logoMime: text(),
  /** ISO 4217 code, used only for display. */
  currency: text().notNull().default("BRL"),
  /** Current hourly rate in cents; copied into each new interval. */
  hourlyRate: integer().notNull().default(0),
  aiEnabled: integer({ mode: "boolean" }).notNull().default(false),
  aiLocale: text({ enum: AI_LOCALES }).notNull().default("en"),
  /** Owner-picked end date (`YYYY-MM-DD`) of the open period's estimate; reset by each invoice. */
  estimatedInvoiceDate: text(),
  archivedAt: integer({ mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Clients allowed to read a project, identified by their Google email. */
export const projectMembers = sqliteTable(
  "project_members",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("project_members_project_email_idx").on(t.projectId, t.email),
    index("project_members_email_idx").on(t.email),
  ],
);

export const projectRepositories = sqliteTable(
  "project_repositories",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Full GitLab path, e.g. `group/subgroup/repo`. */
    path: text().notNull(),
    gitlabProjectId: integer(),
    webUrl: text(),
    lastSyncedAt: integer({ mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("project_repositories_project_path_idx").on(t.projectId, t.path)],
);

export const intervals = sqliteTable(
  "intervals",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    startedAt: integer().notNull(),
    /** `null` while the timer is running. */
    endedAt: integer(),
    /** Hourly rate in cents at the time the interval was recorded. */
    rate: integer().notNull(),
    note: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    index("intervals_project_started_idx").on(t.projectId, t.startedAt),
    index("intervals_started_idx").on(t.startedAt),
    // At most one running timer across the whole app, enforced by SQLite.
    uniqueIndex("intervals_single_running_idx")
      .on(sql`(${t.endedAt} IS NULL)`)
      .where(sql`${t.endedAt} IS NULL`),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Inclusive last day of the period (`YYYY-MM-DD`). */
    date: text().notNull(),
    name: text().notNull(),
    /** Snapshot taken when the invoice was created. */
    durationMs: integer().notNull(),
    subtotal: integer().notNull(),
    extrasTotal: integer().notNull(),
    total: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invoices_project_date_idx").on(t.projectId, t.date)],
);

/** Fixed additional values, e.g. operational costs. */
export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: id(),
    invoiceId: text()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text().notNull(),
    amount: integer().notNull(),
    position: integer().notNull().default(0),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

/** AI-generated (and owner-editable) summaries of an invoice. */
export const invoiceSummaries = sqliteTable(
  "invoice_summaries",
  {
    id: id(),
    invoiceId: text()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    /** `overall`, or the week start date (`YYYY-MM-DD`) of a weekly summary. */
    scope: text().notNull(),
    headline: text().notNull().default(""),
    content: text().notNull(),
    model: text().notNull().default(""),
    generatedAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("invoice_summaries_invoice_scope_idx").on(t.invoiceId, t.scope)],
);

/** Commit metadata cache. Code diffs are never persisted. */
export const gitlabCommits = sqliteTable(
  "gitlab_commits",
  {
    id: id(),
    repositoryId: text()
      .notNull()
      .references(() => projectRepositories.id, { onDelete: "cascade" }),
    sha: text().notNull(),
    title: text().notNull(),
    message: text().notNull(),
    authorName: text().notNull(),
    authorEmail: text().notNull(),
    authoredAt: integer().notNull(),
    webUrl: text().notNull(),
    additions: integer().notNull().default(0),
    deletions: integer().notNull().default(0),
    branches: text({ mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("gitlab_commits_repository_sha_idx").on(t.repositoryId, t.sha),
    index("gitlab_commits_repository_authored_idx").on(t.repositoryId, t.authoredAt),
  ],
);

export type Project = typeof projects.$inferSelect;
export type Interval = typeof intervals.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InvoiceSummary = typeof invoiceSummaries.$inferSelect;
export type ProjectRepository = typeof projectRepositories.$inferSelect;
export type GitlabCommit = typeof gitlabCommits.$inferSelect;
