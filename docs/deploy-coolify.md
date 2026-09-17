# Deploying to Coolify

Taxi ships as a single Docker image with a SQLite database on a persistent volume. That fits the colini-dev setup: one Coolify host that builds each app from its Dockerfile directly on the ARM VM. No Terraform change is needed, since this is a plain web app behind Coolify's proxy.

## 1. Google OAuth client

In <https://console.cloud.google.com/apis/credentials>, create an OAuth client ID (**Web application**):

- Authorized JavaScript origin: `https://taxi.colini.dev`
- Authorized redirect URI: `https://taxi.colini.dev/api/auth/callback/google`

Use your real domain. You can add `http://localhost:3000` equivalents to the same client for local testing.

## 2. Create the resource

1. In Coolify: **+ New → Application**, select this repository and branch.
2. **Build pack: Dockerfile** (the file at the repository root).
3. **Domains**: `https://taxi.colini.dev`. HTTPS is issued automatically.
4. **Ports exposes**: `3000`.
5. **Healthcheck**: leave Coolify's healthcheck **disabled**. The image has its own `HEALTHCHECK` (on `/api/health`), and Docker runs it automatically. Coolify's check needs `curl` or `wget`, which the image doesn't include.

## 3. Persistent storage

Under **Persistent Storage**, add a **Volume Mount**. The database lives at `/data/taxi.db`. Without this volume, all data is lost on every redeploy.

- **Name**: e.g. `taxi-data`
- **Source Path**: leave **empty**. Coolify then creates a Docker-managed volume, which inherits the image's `/data` ownership, so the non-root app user can write to it.
- **Destination Path**: `/data`

If you'd rather use a folder on the VM as the source (a bind mount), create it first and hand it to the container's user (uid 1001). Otherwise the app can't create the database:

```
sudo mkdir -p /data/coolify/taxi && sudo chown 1001:1001 /data/coolify/taxi
```

## 4. Environment variables

Set these in the resource's **Environment Variables** (mark secrets as secret):

```
BETTER_AUTH_URL=https://taxi.colini.dev
BETTER_AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OWNER_EMAIL=you@gmail.com
TIMEZONE=America/Sao_Paulo

# Optional
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-...            # read_api scope
GITLAB_AUTHOR_EMAILS=you@example.com
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
```

**Don't set `DATABASE_PATH`.** It already defaults to `/data/taxi.db` in the image. A relative value like `./data/taxi.db` (from `.env.example`) makes the app crash with `EACCES: permission denied, mkdir '/app/data'`. If you must set it, use exactly `/data/taxi.db`. None of these variables are needed at build time.

## 5. Resource limits

Following the host runbook, set limits on the resource. The app is light, so **512 MB memory** and **0.5 CPU** are plenty.

## 6. Deploy

Click **Deploy**. On start, the server applies database migrations and then serves requests. Open the domain and sign in with `OWNER_EMAIL`.

## Backups

The database is a single SQLite file. Two options:

- **From the app**: *Settings → Download backup* (owner only) returns a consistent snapshot.
- **On the VM**: schedule a job (Coolify *Scheduled Tasks* on this resource, or cron) that runs a consistent copy inside the container:
  ```
  node -e "require('better-sqlite3')('/data/taxi.db').backup('/data/backup-' + new Date().toISOString().slice(0,10) + '.db')"
  ```
  Then copy the backup off the VM, e.g. to OCI Object Storage.

To restore, stop the app, replace `/data/taxi.db` with the backup (and delete any `taxi.db-wal` / `taxi.db-shm` files), then start it again.

## Updating

Push to the tracked branch and redeploy (or enable automatic deployments). Migrations generated with `npm run db:generate` are committed in `drizzle/` and applied automatically on startup.
