<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Read `README.md` for the billing rules, security model and layout.
- Every page, route handler and Server Action must call a guard from `src/lib/authz.ts` first. Mutations are owner-only. Add new actions to the matrix in `test/authz.test.ts`.
- Billing and time rules are pure functions in `src/lib/billing.ts` / `src/lib/time.ts`; keep them tested.
- Money is integer cents; instants are epoch ms; calendar dates are `YYYY-MM-DD` in `TIMEZONE`.
- UI strings live in `messages/en.json` and `messages/pt-BR.json`; keep both in sync.
- After changing `src/db/schema.ts`, run `npm run db:generate` and commit the migration.
