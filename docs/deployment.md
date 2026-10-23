# Deployment & Operations

This guide describes how to run, configure, and operate the Public Transport Spy three-tier stack (`api`, `frontend`, and `on-chip-software`) across local development, Docker Compose, and production environments.

---

## 1. Quick Start with Docker Compose

The compose file needs two secrets, which you generate once (`.env` is git-ignored):

```bash
cp .env.example .env
# put the output of `openssl rand -hex 32` into ADMIN_API_KEY and into SESSION_SECRET,
# and set PUBLIC_APP_URL to this machine's LAN IP (so the phone you scan the QR code with can reach it)
docker compose up --build -d
```

### Services, Container Names & Port Mappings

Every container, the shared network (`pts-net`), and the Postgres data volume (`pts-postgres-data`) share the `pts` prefix so they're easy to pick out of `docker ps` / `docker volume ls` alongside other projects. All host ports are intentionally non-default (not `3000`, `5432`, etc.) to avoid colliding with other local services.

| Service | Container Name | Host Port → Container Port | Context Directory | Base Image | Role |
|---|---|---|---|---|---|
| **`pts-frontend`** | `pts-frontend` | `7777:7777` | `.` (repo root, `frontend/Dockerfile`) | `node:24-alpine` | Next.js 16 + MUI 9 web dashboard, user accounts, display settings & live preview |
| **`pts-api`** | `pts-api` | `7778:7778` | `.` (repo root, `api/Dockerfile`) | `node:24-bookworm-slim` | NestJS 11 REST API, hardware device gateway & transit aggregator |
| **`pts-postgres`** | `pts-postgres` | `4700:5432` | N/A | `postgres:18-alpine` | Relational persistence for users, devices, configurations, and metrics |

### Health Checks & Status Verification
Verify running containers:
```bash
docker compose ps
```

All three services have a Docker healthcheck (PostgreSQL `pg_isready`, API `/healthz`, frontend `/login`), so `docker compose up --wait` returns only once the whole stack serves requests. The frontend check matters: without it the published port accepts connections and resets them while Next.js is still starting, which made scripted probes (and the CI smoke test) flaky.

Verify backend API health probe:
```bash
curl -i http://localhost:7778/healthz
```

Verify frontend dashboard:
```bash
curl -i http://localhost:7777/
```

---

### Dependencies & Lockfile (npm workspaces)

The repo is an npm-workspaces monorepo (`api`, `frontend`) with **one lockfile: the root `package-lock.json`**. Install and upgrade from the repo root (`npm install`, `npm install <pkg> -w api`). Both Docker images are built with the repository root as context and run `npm ci --workspace <name>` against that lockfile, and CI installs with `npm ci`, so what you develop with, what CI tests and what ships cannot drift apart. All versions in the `package.json` files are pinned exactly (`save-exact=true` in the root `.npmrc`), so `npm install <pkg>` never writes a `^` range; Renovate keeps them current. Two majors are held back on purpose: TypeScript 7 (no programmatic compiler API yet, which Nest CLI, ts-jest and Next need; wait for 7.1) and NestJS 12 / nestjs-pino 5 (ESM-only; the API is CommonJS and Jest/TypeORM CLI/ts-node would need an ESM migration first). Peer dependencies are resolved strictly (no `legacy-peer-deps`), so a real peer conflict fails the install instead of being hidden. The root `.dockerignore` keeps `node_modules`, build output, firmware and docs out of the build context.

```bash
docker compose up -d --build   # rebuild after dependency, API or UI changes
```

---

## 2. Environment Variables

Each service reads its own variables. **Docker Compose** takes everything from the root `.env` ([`.env.example`](../.env.example), commented) and passes the right values to each container. **Running without Docker** uses `api/.env` and `frontend/.env` (copy the `.env.example` next to each). Two values must be shared: `ADMIN_API_KEY` is identical in API and frontend, and `PUBLIC_APP_URL` must be an address your phone can reach.

### 2.0 Root `.env` (Docker Compose)

| Variable | Required | Goes to | Description |
|---|---|---|---|
| `ADMIN_API_KEY` | Yes | api, frontend | Shared secret (`openssl rand -hex 32`). |
| `SESSION_SECRET` | Yes | frontend | Session cookie signing secret, ≥ 32 characters. |
| `PUBLIC_APP_URL` | Recommended | api | Web app address as seen from your phone (QR code). Default `http://localhost:7777` only works on the same machine. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | No | postgres, api | Database credentials; defaults `postgres` / `postgres` / `public_transport_spy`. The port is published on the host as `4700`, so change the password if the host is reachable by others. |
| `PORT` | No | api | Host port of the API (default `7778`). |
| `COOKIE_SECURE` | No | frontend | Default `false` in compose so login works over plain `http://<LAN-IP>`. Set `true` once served over HTTPS. |
| `TRUST_PROXY` | No | api, frontend | `true` only behind one reverse proxy that overwrites `X-Forwarded-For` (default `false`). Passed to **both** services; see [§5](#5-topology--reverse-proxy). |
| `COOKIE_DOMAIN`, `DEVICE_BACKEND_URL` | No | frontend / api | See the tables below. |

### 2.1 Backend API (`api/.env`)
Validated at startup via Zod in [api/src/modules/shared-modules/config/env.validation.ts](../api/src/modules/shared-modules/config/env.validation.ts):

| Variable | Type | Default | Required in Prod | Description |
|---|---|---|---|---|
| `PORT` | Number | `7778` | No | Port on which NestJS listens. |
| `NODE_ENV` | String | `development` | Yes | Environment mode (`development`, `production`, `test`). In `production`, structured JSON logs are emitted. |
| `DATABASE_URL` | URL | `postgres://postgres:postgres@localhost:4700/public_transport_spy` | Yes | PostgreSQL connection string (host port `4700` maps to the `pts-postgres` container's internal `5432`). |
| `ADMIN_API_KEY` | String | None | Yes | Shared secret for administrative and BFF communication (`X-Api-Key`). Must be a strong random secret. |
| `ENABLE_SWAGGER`| Boolean| `false` in prod, `true` in dev | No | Controls whether `/docs` and `/docs-json` are exposed. |
| `TRUST_PROXY` | Boolean | `false` | No | Trust one reverse-proxy hop (`X-Forwarded-For`) so per-IP limits (`device/claim`) see the real device IP. Keep equal to the frontend's value; see [§5](#5-topology--reverse-proxy). |
| `PUBLIC_APP_URL` | URL | `http://localhost:7777` | Yes | Web app URL encoded into device QR codes (`<PUBLIC_APP_URL>/pair?code=…`). Must be reachable from the phone (LAN IP for local tests, public domain in production). Trailing slashes are stripped. |
| `INTEGRATION_DATABASE_URL` | URL | `…:4700/public_transport_spy_test` | No | Only for `npm run test:integration`; the database the tests wipe. Never your real one. |
| `DEVICE_BACKEND_URL` | URL | unset | No | When set, every device switches its API base URL to this value on its next config poll (after checking it answers `/hello`). For domain moves without reflashing. Empty = unset. |

### 2.2 Web Frontend (`frontend/.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | Number | `7777` | Port for the Next.js server. |
| `INTERNAL_API_URL` | URL | unset | Backend URL used by the BFF server-side (in Docker: `http://pts-api:7778`). Takes precedence over `NEXT_PUBLIC_API_URL`. |
| `NEXT_PUBLIC_API_URL` | URL | `http://localhost:7778` | Fallback backend URL (local development). |
| `ADMIN_API_KEY` | String | None | Must match the backend `ADMIN_API_KEY` to allow the BFF to authenticate administrative actions. |
| `COOKIE_SECURE` | Boolean | `true` in production, else `false` | No | Marks the session cookie `Secure`. Browsers drop such cookies on plain `http://<LAN-IP>`, so set `false` for a LAN-only setup without HTTPS (compose does this by default). |
| `COOKIE_DOMAIN` | String | current host | No | Share the login across subdomains, e.g. `.example.com`. |
| `TRUST_PROXY` | Boolean | `false` | No | `true` behind one reverse proxy that overwrites `X-Forwarded-For`: the login throttle then uses the real browser IP (last `X-Forwarded-For` entry). Keep equal to the API's value; see [§5](#5-topology--reverse-proxy). |
| `DEV_ORIGINS` | CSV | none | No | Extra hosts allowed to open the dev server, e.g. your phone's LAN IP when testing pairing. |
| `SESSION_SECRET`| String | None | Secret (≥ 32 characters) used by `jose` to sign browser session cookies. Required in production; there is no fallback, and sessions cannot be created without it. |

---

## 3. Database & Migrations (TypeORM, PostgreSQL 18)

**PostgreSQL 18 is required**: primary keys default to the native `uuidv7()` (see [architecture §1.5](architecture.md#15-data-model-conventions)). The `pts-postgres` service uses `postgres:18-alpine`; its volume is mounted at `/var/lib/postgresql`, because PostgreSQL 18 images store data in a versioned subdirectory (`/var/lib/postgresql/18/docker`).

Migrations run automatically on backend bootstrap when `NODE_ENV !== 'test'`:

```typescript
migrationsRun: config.get('NODE_ENV', { infer: true }) !== 'test'
```

The schema is a single `InitSchema1700000000001` migration (squashed before the first deployment). From now on, every schema change is a **new, additive migration**. Never edit an applied one.

### Manual Migration Management (CLI)
From the `api/` directory (with `DATABASE_URL` exported, e.g. `set -a && . ./.env && set +a`):

```bash
# Run pending migrations
npm run migration:run

# Revert the last applied migration
npm run migration:revert

# Generate a migration from entity changes
npm run migration:generate -- src/modules/database/migrations/AddSomething

# Drift check (CI runs it too): fails if an entity change has no migration
npm run migration:check

# Development seed (3 users with password123, devices with example screen profiles, metrics)
npm run seed            # add `-- --reset` to wipe seeded rows first
```

### Resetting the Local Database
Only for local development: this deletes all data.
```bash
docker compose down -v          # removes the pts-postgres-data volume
docker compose up -d pts-postgres
docker compose up -d --build pts-api   # migrates on start
(cd api && set -a && . ./.env && set +a && npm run seed)
```

---

## 4. Local Development Workflow

### 1. Initialize Environment Files
```bash
cp .env.example .env                  # compose needs ADMIN_API_KEY / SESSION_SECRET even for `up pts-postgres`
cp api/.env.example api/.env
cp frontend/.env.example frontend/.env
```
Fill the secrets in the root `.env` (`openssl rand -hex 32`). The two `.env.example` files in `api/` and `frontend/` already contain working development values.

### 2. Start PostgreSQL Only
```bash
docker compose up -d pts-postgres
```

### 3. Run Applications Concurrently (npm Workspaces)
From the repository root:
```bash
# Start NestJS backend API (watch mode on http://localhost:7778)
npm run dev:api

# Start Next.js frontend dashboard (Turbopack on http://localhost:7777)
npm run dev:frontend
```

### 4. Build & Test Verification Suite
```bash
# Run API unit test suite (Jest; includes the screen contract fixture check)
npm run test:api

# Run API end-to-end suite (supertest; guard, validation, composer, preview)
npm --prefix api run test:e2e

# Run API integration tests: database to API on PostgreSQL 18 (see docs/testing.md)
docker compose up -d pts-postgres && npm run test:integration

# Run live-preview logic tests (node:test against the shared contract fixture)
npm run test:frontend

# Run firmware logic + contract tests on the host
(cd on-chip-software && pio test -e native)

# Build NestJS API
npm run build:api

# Build Next.js frontend
npm run build:frontend

# Compile ESP32 firmware (PlatformIO)
npm run firmware:build
```

---

## 5. Topology & Reverse Proxy

**Supported topology:** frontend and API are deployed **together** (the Compose stack), the browser only talks to the frontend (BFF), the API is reachable by the frontend over the internal network, and ESP32 displays call the API directly. Put **one** reverse proxy (nginx, Caddy, Traefik, Cloudflare) in front for HTTPS:

```
Browser ──► proxy ──► frontend (BFF) ──► API (internal, X-Api-Key) ◄── proxy ◄── ESP32 displays
```

### 5.1 Why `TRUST_PROXY` exists and must match

Rate limiting needs the real client IP, which only the proxy knows:

| Limit | Needs | Where |
|---|---|---|
| `POST /api/v1/device/claim` (10/min per IP) | the display's IP | API reads `X-Forwarded-For` when `TRUST_PROXY=true` |
| `POST /v1/auth/login` (10 / 15 min per IP + username, 30 / 15 min per IP) | the browser's IP | frontend reads the last `X-Forwarded-For` entry when `TRUST_PROXY=true` and forwards it as `X-Client-Ip`; the API trusts that header because it comes with the `X-Api-Key` only the frontend holds |
| `register`, `pair` | nothing | shared buckets, because requests come from the BFF |

Set `TRUST_PROXY=true` in the root `.env` (Compose passes it to **both** services) **only** if a proxy overwrites `X-Forwarded-For` with the connecting address. Examples: nginx `proxy_set_header X-Forwarded-For $remote_addr;` (not `$proxy_add_x_forwarded_for`), Caddy sets it by default. With `TRUST_PROXY=true` and **no** proxy, anyone can send a forged header and dodge the IP limits; with `false` behind a proxy, every client looks like the proxy.

### 5.2 What happens if only a part is deployed or misconfigured

| Situation | Result |
|---|---|
| `TRUST_PROXY=false` (default), clients connect directly | Safe. Device limits are per direct client IP. All logins share one bucket (30 / 15 min for everyone), because the frontend cannot know browser IPs. Fine for a small LAN setup. |
| `false` behind a proxy | Every device and every browser looks like the proxy: `device/claim` is limited to 10/min **in total**, logins to 30 / 15 min in total. Symptom: `429` for legitimate users. Fix: enable the proxy and `TRUST_PROXY=true` on both. |
| `true` on the API only | Device limits are correct; logins share one bucket (frontend does not forward the IP). |
| `true` on the frontend only | Login limits are correct; devices look like the proxy (or direct clients can forge `X-Forwarded-For` if the API is exposed without a proxy). |
| `true` without a proxy that overwrites the header | IP limits can be bypassed by sending a fake `X-Forwarded-For`. Never do this. |
| API deployed without this frontend (own client) | Send `X-Api-Key` and optionally `X-Client-Ip: <end user IP>` on `POST /v1/auth/login` yourself; without it the limits use the caller's address. |
| Frontend deployed against an older API | The extra `X-Client-Ip` header is ignored; logins are limited by the frontend's address. |
| API port published to the internet | Do not: only devices need it (`/api/v1/device/*`). Expose only those paths through the proxy; `/v1/*` must stay reachable by the frontend alone, protected by `ADMIN_API_KEY`. |

Behind a **second** proxy (e.g. Cloudflare in front of nginx), `TRUST_PROXY=true` trusts one hop only; configure the outer proxy's real-IP handling in nginx (`real_ip_header`) so it overwrites `X-Forwarded-For` with the visitor's address.
