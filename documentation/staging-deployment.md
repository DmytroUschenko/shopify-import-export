# Staging Deployment Guide

Step-by-step guide for deploying to `https://uho.kharkiv.ua/shopify` on a fresh server.

---

## Architecture

The Docker stack (nginx, api, web, postgres, redis) runs on the server listening on port **8080**.
An outer OS-level nginx terminates HTTPS and proxies `/shopify/*` → `localhost:8080/`, stripping the path prefix.

```
Browser → https://uho.kharkiv.ua/shopify/*
              ↓
         OS nginx (443) — strips /shopify prefix
              ↓
         Docker nginx (8080)
              ↓ /api/*       ↓ /*
           api:3001       web:3000
              ↓
         postgres + redis
```

---

## Part 1 — Create a Staging Shopify App

**Never share credentials between environments.** Create a dedicated app for staging.

1. Go to [partners.shopify.com](https://partners.shopify.com) → **Apps → Create app → Create app manually**
2. Name it `entity-import-stage` (or similar)
3. Set **App URL**: `https://uho.kharkiv.ua/shopify`
4. Set **Allowed redirection URLs**: `https://uho.kharkiv.ua/shopify/auth/callback`
5. Copy the **Client ID** and **Client secret** — needed for `.env`

**Connect to your dev store:**

Partners dashboard → your stage app → **Test on development store** → select dev store → Install

---

## Part 2 — Server Setup (one-time, empty server)

SSH into the server, then run:

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose plugin (if not bundled with Docker)
sudo apt-get install -y docker-compose-plugin

# Tools
sudo apt-get install -y make git

# Outer nginx + Certbot for HTTPS
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

---

## Part 3 — Clone & Configure

```bash
cd /opt
sudo git clone <your-repo-url> shopify-import-stage
sudo chown -R $USER:$USER shopify-import-stage
cd shopify-import-stage

cp .env.example .env
nano .env
```

Fill in `.env`:

```dotenv
# Postgres
POSTGRES_DB=shopify_import_stage
POSTGRES_USER=stage_user
POSTGRES_PASSWORD=<strong-random-password>

# Database — must match the values above
DATABASE_URL=postgresql://stage_user:<strong-random-password>@postgres:5432/shopify_import_stage

# Redis
REDIS_URL=redis://redis:6379

# Shopify — credentials from the new stage app created in Part 1
SHOPIFY_API_KEY=<stage_client_id>
SHOPIFY_API_SECRET=<stage_client_secret>
SHOPIFY_APP_URL=https://uho.kharkiv.ua/shopify

# Internal Docker networking — do not change
API_INTERNAL_URL=http://api:3001

# API
TYPEORM_SYNCHRONIZE=true
API_PORT=3001

# Web
WEB_PORT=3000

NODE_ENV=production
```

> **Do not commit `.env`** — it is already in `.gitignore`.

---

## Part 4 — Configure Outer Nginx (HTTPS + subpath proxy)

### 4a. Initial HTTP config (for Certbot)

```bash
sudo nano /etc/nginx/sites-available/shopify-stage
```

```nginx
server {
    listen 80;
    server_name uho.kharkiv.ua;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/shopify-stage /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4b. Obtain SSL certificate

```bash
sudo certbot --nginx -d uho.kharkiv.ua
```

### 4c. Add proxy location (after certbot adds HTTPS block)

```bash
sudo nano /etc/nginx/sites-available/shopify-stage
```

Add inside the `server { listen 443 ssl; ... }` block:

```nginx
# Proxy /shopify/* to Docker nginx, stripping the /shopify prefix.
# The trailing slash in proxy_pass is what strips the prefix.
location /shopify/ {
    proxy_pass         http://127.0.0.1:8082/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto https;
}

# Redirect bare /shopify to /shopify/
location = /shopify {
    return 301 /shopify/;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **Why the trailing slash matters**: `proxy_pass http://127.0.0.1:8082/` strips `/shopify` before forwarding, so the app sees `/`, `/api/`, `/auth/callback`, etc. — matching what it expects internally.

---

## Part 5 — Deploy

```bash
cd /opt/shopify-import-stage
make deploy
```

This will:
1. Detect if `.env` is missing (copies `.env.example` and exits — fill in values and re-run if so)
2. Build Docker images for `api` and `web` (multi-stage builds)
3. Start postgres → redis → api → web → nginx in dependency order
4. Print container status
5. Run health check via `http://localhost:8080/health`

---

## Part 6 — Verify

```bash
# Container status — all should show (healthy)
make ps

# Health check through Docker nginx
make health

# Health check through outer nginx + HTTPS
curl https://uho.kharkiv.ua/shopify/health

# Tail logs if something looks wrong
make logs-api
make logs-web
```

Then open `https://uho.kharkiv.ua/shopify` in a browser — it should redirect to Shopify OAuth and land you in the embedded app.

---

## Part 7 — Redeploying After Code Changes

```bash
cd /opt/shopify-import-stage
make redeploy        # git pull + rebuild all services
make redeploy-api    # git pull + rebuild api only
make redeploy-web    # git pull + rebuild web only
```

---

## Environment Variable Reference

| Variable | Change for stage? | Stage value |
|---|---|---|
| `POSTGRES_DB` | Yes | `shopify_import_stage` |
| `POSTGRES_USER` | Yes | any unique user |
| `POSTGRES_PASSWORD` | Yes | strong random password |
| `DATABASE_URL` | Yes | must match above |
| `REDIS_URL` | No | `redis://redis:6379` |
| `SHOPIFY_API_KEY` | **Yes** | stage app client ID |
| `SHOPIFY_API_SECRET` | **Yes** | stage app client secret |
| `SHOPIFY_APP_URL` | **Yes** | `https://uho.kharkiv.ua/shopify` |
| `API_INTERNAL_URL` | No | `http://api:3001` |
| `TYPEORM_SYNCHRONIZE` | No | `true` is fine for stage |
| `NODE_ENV` | No | `production` |

---

## Staging Checklist

- [ ] New Shopify app created in Partners dashboard with stage URL
- [ ] Stage app installed on dev store
- [ ] `.env` filled in with stage credentials (not committed)
- [ ] SSL certificate issued via Certbot
- [ ] Outer nginx config tested (`sudo nginx -t`)
- [ ] `make deploy` completed — all containers healthy
- [ ] `https://uho.kharkiv.ua/shopify/health` returns `{"status":"ok"}`
- [ ] Shopify OAuth flow completes in browser
