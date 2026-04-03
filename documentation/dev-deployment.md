# Local Development Guide

This guide covers everything needed to run the full stack locally with hot-reload using Docker Compose.

---

## Architecture — Dev vs Production

In development, **application containers run source code directly** (no build step).  
Infra containers (`postgres`, `redis`) are identical to production.

| Container | Dev mode | Reload trigger |
|---|---|---|
| `api` | `ts-node-dev` — TypeScript executed directly | Any `.ts` file save |
| `web` | Vite dev server (`react-router dev`) | Any file save → HMR in browser |
| `postgres` | Same `postgres:16` image | — |
| `redis` | Same `redis:7-alpine` image | — |

> There is **no nginx** in the dev stack. Each service is accessed on its own port.  
> Port layout: web → **3000**, api → **3001**.

---

## Prerequisites

- Docker ≥ 24 with Docker Compose v2 (`docker compose` subcommand)
- GNU Make (pre-installed on macOS)
- A Shopify Partner account with an app already created
- [ngrok](https://ngrok.com/) installed (`brew install ngrok`)
- Your `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` from the Shopify Partner Dashboard

---

## ngrok — Why It Is Required

Shopify Admin is cloud-hosted. For OAuth, webhooks, and App Bridge to work, Shopify must be able to reach your local machine over **HTTPS with a trusted certificate**.  
ngrok creates a secure public tunnel that points to your local dev server.

```
[Shopify cloud] ──HTTPS──► [ngrok public URL] ──HTTP──► [localhost:3000  (web)]
                                                    └──► [localhost:3001  (api/webhooks)]
```

A single ngrok tunnel pointing at the **web** service on port 3000 is enough —  
the web app proxies all `/api/*` and `/webhooks/*` paths internally to the api container.

---

## Step 1 — Create / Configure the ngrok Tunnel

### Option A — ngrok free plan (random URL, changes on every restart)

Free accounts get a random subdomain each time ngrok starts. You must update `.env` and `shopify.app.toml` after every restart.

```bash
ngrok http 3000
```

Copy the `Forwarding` URL, e.g. `https://abc123.ngrok-free.app`.

### Option B — ngrok paid plan (static domain, recommended)

With a static domain the URL never changes — no updates to config between restarts.

```bash
# Reserve your domain once in the ngrok dashboard, then:
ngrok http --domain=your-reserved-domain.ngrok-free.app 3000
```

---

## Step 2 — Configure Environment Variables

Copy the example file if you haven't already:

```bash
cp .env.example .env
```

Edit `.env` and set the three Shopify-related variables:

```dotenv
SHOPIFY_API_KEY=<your_api_key>          # from Shopify Partner Dashboard
SHOPIFY_API_SECRET=<your_api_secret>    # from Shopify Partner Dashboard
SHOPIFY_APP_URL=https://<your-ngrok-url> # from ngrok output — must be HTTPS, no trailing slash
```

Leave all other variables at their defaults for local development — they already point to the Docker services (`postgres`, `redis`).

---

## Step 3 — Update shopify.app.toml

`apps/web/shopify.app.toml` stores the app URL that is pushed to the Shopify Partners platform. It **must match** `SHOPIFY_APP_URL` in `.env`.

```toml
application_url = "https://<your-ngrok-url>"
```

If you are using the **ngrok free plan**, update this file every time your URL changes.  
If you are using a **static ngrok domain**, set it once and commit it.

> The `client_id` in `shopify.app.toml` must match `SHOPIFY_API_KEY` in `.env`.  
> These values come from the **same** Shopify Partner Dashboard app entry — do not mix credentials from different apps.

---

## Step 4 — Configure Redirect URLs in the Partner Dashboard

Shopify OAuth requires the redirect URL to be whitelisted in the Partner Dashboard.

1. Open [partners.shopify.com](https://partners.shopify.com) → Apps → your app → Configuration.
2. Under **App URL**, set: `https://<your-ngrok-url>`
3. Under **Allowed redirection URL(s)**, add:
   ```
   https://<your-ngrok-url>/auth/callback
   https://<your-ngrok-url>/auth/shopify/callback
   https://<your-ngrok-url>/shopify/auth/callback
   ```
4. Save.

---

## Step 5 — Start the Dev Stack

```bash
make dev
```

This single command will:

1. Detect if `.env` is missing — if so, copy `.env.example` → `.env`, prompt you to fill it in, then exit.
2. Start `postgres`, `redis`, `api`, and `web` in the background.
3. Tail all container logs in your terminal (Ctrl-C detaches logs — containers keep running).

**First run takes longer** — pnpm installs all workspace dependencies inside named Docker volumes. Subsequent starts reuse those volumes and start in seconds.

Expected output once healthy:

```
api   | [NestJS] Application is running on: http://0.0.0.0:3001
web   | ➜  Local:   http://0.0.0.0:3000/
web   | ➜  Network: http://172.x.x.x:3000/
```

---

## Step 6 — Install the App on a Development Store

1. Open your ngrok URL in a browser: `https://<your-ngrok-url>?shop=<your-dev-store>.myshopify.com`  
   — or —  
   From the Partner Dashboard → Apps → your app → "Test on development store".
2. Complete the OAuth flow. The app will redirect back through ngrok → web container → Shopify session is stored in postgres.
3. You're now embedded in Shopify Admin.

---

## Day-to-Day Workflow

### Start

```bash
# In terminal 1: start ngrok (keep running)
ngrok http 3000

# In terminal 2: start Docker services (if not already running)
make dev
```

### Code changes

- **api** (`apps/api/src/**`) — `ts-node-dev` detects the change and restarts the NestJS process automatically. No action needed.
- **web** (`apps/web/app/**`) — Vite HMR pushes the update to the browser instantly. No reload needed.
- **Shared types** (`packages/shared/src/**`) — both services pick up changes on their next reload cycle.

### Stop (keep containers for next time)

Ctrl-C in the log-tailing terminal detaches but leaves containers running.  
To fully stop:

```bash
make dev-down
```

### Useful commands

| Command | Description |
|---|---|
| `make dev` | Start all services + tail logs |
| `make dev-down` | Stop containers (keep node_modules volumes) |
| `make dev-ps` | Show service status |
| `make dev-logs` | Re-attach to all logs |
| `make dev-logs-api` | Tail api logs only |
| `make dev-logs-web` | Tail web logs only |
| `make dev-down-volumes` | Full reset — removes all dev volumes (re-installs deps on next start) |
| `make db-shell` | Open psql prompt in the postgres container |

---

## Troubleshooting

### ngrok URL changed (free plan) after restart

1. Copy the new URL from ngrok output.
2. Update `SHOPIFY_APP_URL` in `.env`.
3. Update `application_url` in `apps/web/shopify.app.toml`.
4. Update redirect URLs in the Partner Dashboard (Step 4).
5. Update `server.allowedHosts` in `apps/web/vite.config.ts` to include the new ngrok hostname:
   ```ts
   server: {
     allowedHosts: ["<your-new-ngrok-hostname>"],
   },
   ```
6. Restart web container to pick up the new env var:
   ```bash
   docker compose -f docker-compose.dev.yml restart web
   ```

### "Blocked request. This host is not allowed" in Shopify Admin

Vite rejects requests from hosts not explicitly trusted. Add your ngrok hostname to `server.allowedHosts` in `apps/web/vite.config.ts`:

```ts
server: {
  port: 3000,
  host: true,
  allowedHosts: ["<your-ngrok-hostname>"],
},
```

Then restart the web container:

```bash
docker compose -f docker-compose.dev.yml restart web
```

### "Invalid OAuth callback URL" from Shopify

The redirect URL in the Partner Dashboard does not match the URL being used.  
Re-check Step 4 — all three callback patterns must be listed.

### API container exits immediately

Check logs for TypeScript errors:

```bash
make dev-logs-api
```

`ts-node-dev` will print the compile error and then wait — it does **not** restart until you fix the error and save the file.

### node_modules inside the container are stale / wrong version

Run a full dev volume reset:

```bash
make dev-down-volumes
make dev
```

This forces a fresh `pnpm install` on next start.

### Port already in use

Another process is using 3000 or 3001. Find and stop it:

```bash
lsof -ti :3000 | xargs kill -9
lsof -ti :3001 | xargs kill -9
```

---

## Security Notes

- Never commit `.env` — it contains your `SHOPIFY_API_SECRET`. `.gitignore` already excludes it.
- The ngrok URL is publicly accessible. Shopify HMAC validation in `webhook.middleware.ts` protects the webhook endpoint; the OAuth flow protects the web app. There is no additional tunnel secret needed.
- `TYPEORM_SYNCHRONIZE=true` is fine for local development. Never enable it in production — use migrations instead.
