# Taxi

Time tracking and invoicing for freelance work. It follows a spreadsheet workflow: a list of timed intervals, each with its own hourly rate, and a monthly invoice that adds up everything since the previous one. It adds client-facing reports, GitLab activity and AI-written weekly summaries.

- **Timer**: one-click start/stop with a live clock, today's total and a single running timer across all projects.
- **Time entries**: add past time with an end time or a duration. Time covered by an invoice is locked.
- **Invoices**: pick a date and everything started after the previous invoice, up to and including that date, is billed. Add fixed extras (e.g. operational costs). Reports show a weekly breakdown and print to PDF.
- **Clients**: invite a client's Google account to a project. They get read-only access to its progress, charts and invoices.
- **GitLab**: commit counts, branches and line stats per week.
- **AI summaries**: Claude reads the period's commits and diffs and writes weekly and overall summaries. You can edit them.
- **Import**: bring in the old spreadsheet's time table and invoice dates from CSV.
- English and Brazilian Portuguese; light and dark themes; works on mobile and desktop.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · SQLite (better-sqlite3 + Drizzle ORM) · Better Auth (Google OpenID Connect) · Tailwind CSS 4 + shadcn/ui · Recharts · next-intl · Anthropic SDK · Vitest.

## Running locally

Requirements: Node.js 22+.

1. Create a Google OAuth client at <https://console.cloud.google.com/apis/credentials> (type **Web application**) with the redirect URI `http://localhost:3000/api/auth/callback/google`.
2. Configure the environment:
   ```bash
   cp .env.example .env.local
   # Fill in BETTER_AUTH_SECRET (openssl rand -base64 32), GOOGLE_CLIENT_ID,
   # GOOGLE_CLIENT_SECRET and OWNER_EMAIL (your Google account).
   ```
3. Install and start:
   ```bash
   npm install
   npm run dev
   ```
4. Open <http://localhost:3000> and sign in with the `OWNER_EMAIL` account.

The SQLite database is created at `DATABASE_PATH` (default `./data/taxi.db`). Migrations run automatically when the server starts.

To try the production image locally:

```bash
docker compose up --build
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests and the authorization test matrix |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a SQL migration after changing `src/db/schema.ts` |

## Configuration

All configuration is through environment variables; see [`.env.example`](.env.example). GitLab and AI are optional: their features stay hidden or disabled until configured.

| Variable | Required | Notes |
|---|---|---|
| `BETTER_AUTH_URL` | yes | Public URL, e.g. `https://taxi.colini.dev` |
| `BETTER_AUTH_SECRET` | yes | At least 32 random characters |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google OAuth client |
| `OWNER_EMAIL` | yes | The only account that can change data |
| `DATABASE_PATH` | no | Defaults to `./data/taxi.db` (`/data/taxi.db` in Docker) |
| `TIMEZONE` | no | Days, weeks and invoice dates. Default `America/Sao_Paulo` |
| `GITLAB_URL`, `GITLAB_TOKEN` | no | Token needs only the `read_api` scope |
| `GITLAB_AUTHOR_EMAILS` | no | Comma-separated; only these authors' commits are counted |
| `ANTHROPIC_API_KEY` | no | Enables AI summaries |
| `ANTHROPIC_MODEL` | no | Default `claude-opus-5` |

## How billing works

- An interval belongs to the day it **starts** in `TIMEZONE`, even if it ends after midnight.
- An invoice dated `D` covers intervals whose start date is after the previous invoice's date and **on or before `D`**.
- The amount is the sum of each interval's duration × its own hourly rate, grouped by rate, plus the invoice's extra items. Totals are snapshotted when the invoice is created.
- Intervals covered by an invoice can't be added, edited or deleted. Only the latest invoice can be deleted, which unlocks its period.
- Changing a project's rate affects new intervals. Optionally it also reprices the current, not-yet-invoiced period.

The rules live in [`src/lib/billing.ts`](src/lib/billing.ts) and are covered by [`src/lib/billing.test.ts`](src/lib/billing.test.ts).

## Importing the spreadsheet

Open a project's **Settings → Import from CSV**. Export the times table and the invoices table as CSV (Google Sheets: *File → Download → CSV*). Upload both and check the column mapping and date format, then review the preview. Rows with problems (missing end, overlaps, invalid dates) are listed and skipped. Nothing is saved until you click **Import**, and the import runs in a single transaction.

## Security model

- Sign-in is Google only. Accounts that are neither `OWNER_EMAIL` nor invited to a project are rejected at sign-in, and access is re-checked on every request.
- Every page, route handler and Server Action goes through [`src/lib/authz.ts`](src/lib/authz.ts). Every mutation is owner-only. Clients can read only the projects they're invited to. Denials return 404, so project IDs don't leak.
- [`test/authz.test.ts`](test/authz.test.ts) calls every Server Action as anonymous, stranger, client and owner.
- Strict nonce-based Content Security Policy and security headers. Logos must be PNG, JPEG or WebP (no SVG) and are served only to viewers with access. AI and commit text is rendered as markdown without raw HTML.
- Secrets come only from environment variables. Code diffs are sent to Anthropic only for projects with AI enabled and are never stored.

## Project layout

```
src/
  app/            routes: dashboard, projects/[projectId]/…, login, settings, api/
  components/     UI (ui/ holds shadcn primitives)
  db/             Drizzle schema and connection
  lib/            billing, time, money, import parsing, auth, authz, GitLab and AI clients
  server/         Server Actions (actions/) and data queries (queries/)
  i18n/           next-intl request config
messages/         en.json, pt-BR.json
drizzle/          SQL migrations
test/             authorization tests
```

## Deployment

See [docs/deploy-coolify.md](docs/deploy-coolify.md).
