# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and pair-programming assistants when working with code in this repository.

## Commands

```bash
# Development (run concurrently from root)
npm run dev:api           # Start NestJS backend (port 7778, watch mode)
npm run dev:frontend      # Start Next.js frontend (port 7777, Turbopack)

# Testing & Verification
npm run test:api          # Jest unit tests for backend API (incl. screen contract fixture check)
npm run test:frontend     # frontend logic tests (*.test.ts, node:test, typechecked with frontend/tsconfig.test.json): live preview vs the shared contract fixture, admin metrics, pairing codes
npm --prefix api run test:e2e   # HTTP pipeline with in-memory repositories
npm run test:integration  # Database-to-API: real AppModule + PostgreSQL 18 (needs `docker compose up -d pts-postgres`)
npm run migration:check   # Entities vs migrations (needs DATABASE_URL of a migrated DB); CI runs it after the integration tests
npm run typecheck:api     # TypeScript compiler check without emitting
npm run build:api         # Build NestJS API to api/dist/
npm run build:frontend    # Build Next.js frontend to frontend/.next/

# Firmware (ESP32)
npm run firmware:build    # PlatformIO build for esp32dev (runs pio run -d on-chip-software)
npm run firmware:upload   # Flash compiled binary to connected ESP32

# Monorepo full build
npm run build             # Run build:api and build:frontend
```

---

## Architecture Overview

**Public Transport Spy** is a three-tier monorepo for connected transit departure displays:

```
├── api/                  # NestJS 11 backend (Node 24, TypeORM, PostgreSQL 18)
├── frontend/             # Next.js 16 frontend (App Router, Turbopack, React 19.3, Material UI 9, Tailwind 4)
├── on-chip-software/     # ESP32 C++ firmware (PlatformIO, U8g2 SSD1322 SPI, LittleFS)
├── docs/                 # System architecture and API references
└── agents/               # Short pointers into this file and docs/
```

---

## Key Development Rules & Invariants

### 1. API Security & Access Control
- **`AdminApiKeyGuard` (`X-Api-Key`):**
  - **Public exact routes:** `/healthz`, `/docs`, `/docs-json`, `/v1/auth/register`, `/v1/auth/login`.
  - **Public prefix routes:** `/api/v1/device/*`, `/v1/transit/*`.
  - **Protected routes:** `/v1/devices/*`, `/v1/auth/user/:userName`.
  - Fail-closed: Throws `401 Unauthorized` if `ADMIN_API_KEY` is not configured on the server.
- **Device Authentication & Pairing:**
  - A never-claimed device has no row in the database. `GET /api/v1/device/config` returns `404` for an unrecognized UUID — it is never auto-registered (this used to trust-on-first-use any UUID-shaped string, which was guessable/racy; closed by the claim flow below).
  - The ESP32 generates its own 6-character pairing code locally (`esp_random()`, no network call) and displays it before contacting the backend at all.
  - Admin enters that code in the UI (`POST /v1/devices/pair`), which creates/updates a pending device row (`deviceUuid: null`) bound to their `userId`.
  - Only then does the device call `POST /api/v1/device/claim` with `{ pairingCode, deviceUuid }`; the backend binds the real UUID to the matching pending row and issues the random `deviceToken` used as the bearer credential from then on (the UUID itself is never the secret).
  - Subsequent requests: Must include header `X-Device-Token`. Compared using `timingSafeEqual`.
  - Telemetry: `POST /api/v1/device/metrics` returns `404` for unknown UUIDs (prevents metrics squatting).
- **User Authentication:**
  - Password hashing via `bcryptjs`. Enforce maximum length of 72 characters to prevent bcrypt silent truncation attacks.
  - Constant-time dummy hash comparison for non-existent users on login.
  - Rate limiting via `@nestjs/throttler`, opted in per endpoint (`@UseGuards(ThrottlerGuard)` + `@Throttle`): `device/claim` (10/min per IP), `register` (20/h), `pair` (30/min), and `login` (`LoginThrottlerGuard`: 10 per 15 min per client IP + username, 30 per client IP; the BFF forwards the browser IP in `X-Client-Ip` when `TRUST_PROXY=true` on frontend and API, see docs/deployment.md §5; profile/password/delete routes need a session and are not throttled). `/v1/*` arrives through the BFF, so IP buckets there are shared by all users.
- **DTO Sanitization:**
  - `toDetailDto()` must never expose `deviceToken` or expired `pairingCode` in responses.

### 1a. Persistence Conventions
- PostgreSQL 18. All entities extend `AbstractEntity`: UUIDv7 `id` via native `uuidv7()` default, `createdAt`/`updatedAt`.
- Entities never leave services: response DTOs extend `AbstractDto` and are built by explicit mappers (`toUserDto`, `toDetailDto`, `toMetricDto`) spreading `toAbstractDto()`.
- Telemetry counters are plain `integer` columns (DTO-validated `@Max(2147483647)`), so no `bigint` string handling is needed; indexes/FKs have explicit names so `migration:generate --dryrun` reports no drift.
- One squashed `InitSchema` migration; every later change is a new migration (see docs/deployment.md §3).

### 2. Frontend BFF Architecture
- **Route Handlers (`frontend/src/app/api/v1/*`):**
  - The browser authenticates via encrypted `session` cookie (Jose JWT).
  - The Next.js BFF server verifies the session and proxies requests to the NestJS backend, injecting `'X-Api-Key': ADMIN_API_KEY`.
  - Browser clients must **never** receive the `ADMIN_API_KEY`.

### 1b. Product Rules
- **Never invent departures.** Upstream failures surface as `503` / the composer's `Timetable temporarily unavailable`; empty stations show `No departures scheduled right now`.
- **Telemetry is admin-only** (`/admin`, `/api/v1/admin/*`); BFF admin routes check the role via the API (`verifyAdminSession()`), never from the cookie.
- **Time zones** are stored as IANA names from `device/timezones/timezones.ts`; the firmware only ever receives the POSIX form.
- **Device ownership:** a hardware UUID belongs to exactly one account (claims for a UUID owned by another account get `403`). It is freed by unpairing, transfer (`POST /v1/devices/:uuid/transfer`, by unique username) or account deletion (`DELETE /v1/auth/user/:userName`, password required), which releases displays with `RELEASED_DEVICE_RESET`. Accounts may own any number of displays.
- **Pairing requests:** a pending request (no hardware UUID) belongs to the account that entered the code first (409 for others), is cancelled via `DELETE /v1/devices/pending/:id` (internal id, owner-checked), and expired ones are removed on pair and list. Claimed devices are only ever addressed by their hardware UUID.
- **Display power:** `isConfigured=false` and the optional schedule (`scheduleOn/Off` minutes, `scheduleDays` bits with bit 0 = Sunday) blank the OLED on the device; the preview mirrors it.

### 2a. Frontend Conventions
- Dependencies: every version in `package.json` is **exact** (no `^`/`~`, `save-exact=true` in `.npmrc`); install/upgrade from the repo root; the root `package-lock.json` is the only lockfile (the frontend Docker image builds from the repo root with `npm ci --workspace frontend`). Held back on purpose (Renovate ignores these majors, see `.github/renovate.json5`): TypeScript 7 (no compiler API for Nest CLI/ts-jest/Next yet, wait for 7.1) and NestJS 12 / nestjs-pino 5 (ESM-only, needs an ESM migration of the API).
- MUI 9 (the upgrade from 6 hit each of these): `Grid` with `size={{ xs: 12, md: 6 }}` (no `item`/`xs` props, no `Grid2`); layout props of Stack/Typography/Box/Card/Alert go in `sx`; `slotProps` instead of `inputProps`/`InputProps`/`PaperProps` (`TextField` → `slotProps={{ htmlInput, input, inputLabel }}`, `Dialog` → `slotProps={{ paper }}`); theme variants via `variants: [{ props: { variant }, style }]`; some icons are `…Outlined` now (`DeleteOutlined`, `AddCircleOutlined`).
- Theme: dark, `src/theme/theme.ts` + `theme-registry.tsx` (`@mui/material-nextjs/v16-appRouter`); palette as CSS variables in `src/app/globals.css` (`--bg` OLED-dark, `--fg`, accents `--a1`/`--a2`, lines `--line`/`--line-2`).
- Global CSS stays in `@layer base`: MUI lives in `@layer mui` (`enableCssLayer: true`) and loses to any unlayered rule.
- Components using MUI `Tooltip` are client components (from a Server Component the child arrives serialized and hydration mismatches); never nest a button inside a link, give the `Button`/`IconButton` an `href` or `component={Link}`.
- **BFF ownership checks:** the API trusts the single `ADMIN_API_KEY` and has no per-user authorization, so every single-resource BFF route (e.g. `app/api/v1/devices/[uuid]/route.ts`) must `verifySession()` **and** confirm `device.userId === session.userId` (shared `getOwnedDevice()` helper) before proxying, returning `404` otherwise so a UUID probe cannot tell "not yours" from "does not exist". Skipping it is a broken-access-control bug. List/pair routes scope by `session.userId`.
- Forms: controlled inputs with client-side validation before calling the BFF; `react-hook-form-mui` for login/registration. Prefer Server Components; add `'use client'` only for state, effects or browser APIs. Never reference `ADMIN_API_KEY` in client components.

### 2b. API Conventions
- Every request body DTO has `class-validator` decorators; the global `ValidationPipe` uses `whitelist: true`, `forbidNonWhitelisted: false` (strip unknown fields: devices in the field run other firmware versions) and `transform: true`.
- Passwords: `@MaxLength(72)`. Usernames: `@Matches(/^[a-z0-9_.-]{3,32}$/)` with a trim + lowercase `@Transform`. Hardware UUIDs: `/^[A-Za-z0-9_-]{4,64}$/`.
- Throw Nest exceptions directly (`NotFoundException`, `ConflictException`, …); there is no custom error wrapper or exception filter.
- Entities: extend `AbstractEntity` (never declare your own primary key), name every index and FK (`IDX_<table>_<column>`, `FK_<table>_<column>`), avoid `bigint` (the `pg` driver returns strings; telemetry counters are `integer` with a `@Max(2147483647)` DTO check). A schema change = change the entity, generate a new migration, run `npm run migration:check`.
- `AdminApiKeyGuard` strips the query string before matching paths; public routes are the exact/prefix lists in section 1.

### 3. ESP32 Firmware & Hardware Constraints
- **Flash Partition:** Uses `huge_app.csv` (3.0 MB single app slot, so no OTA; 896 KB LittleFS).
- **RAM Headroom:** Static RAM (the build's `RAM:` line) must stay under ~55 KB of 320 KB; at runtime a TLS handshake needs ~40–50 KB of contiguous heap (watch `ramMaxAllocBlock` in device metrics). `loop()` stays non-blocking (only HTTP blocks).
- **Display Driver:** SSD1322 256x64 yellow/white OLED via 4-wire hardware SPI (`U8g2`, pins in `src/display.cpp`). Buying, wiring and power: `docs/hardware-guide.md`; keep its pin table in sync.
- **Offline Mode:** Never reboot or hang on Wi-Fi drop. Wi-Fi state is re-checked every loop. Serve `/screens.json` with `[OFFLINE]` badge.
- **Identity:** random per-install UUID in `/id.txt` (never MAC-derived). BOOT button: short press = Wi-Fi portal, hold 10 s = factory reset.
- **Fixed vs. variable values:** see `docs/on-chip-firmware.md` §8. Prefer adding an optional server-sent config field over a new hardcoded constant; keep that table in sync when firmware constants change.
- **Screens are server-composed:** the backend's `screens/screen-composer.ts` turns the owner's display profile into widgets for `GET /api/v1/device/screens`; the firmware only renders (`renderPage` in `on-chip-software/src/display.cpp`; `main.cpp` keeps the state machine and `drawScreen()`, which picks what to show). New layouts belong in the composer, not in firmware. Keep the widget contract additive (docs/api-reference.md §2.2a).
- **Integration tests:** behaviour that depends on the database (ownership, uniqueness, transactions, jsonb) gets a database-to-API test in `api/test/integration/*.int-spec.ts` (see docs/testing.md). They use a separate `public_transport_spy_test` database, never the dev one.
- **Logic & contract tests:** pure helpers in `on-chip-software/include/device_logic.h` and `screen_logic.h`; `pio test -e native` runs them plus `test_contract`, which renders the backend-pinned `screens.fixture.json`. After an intended composer change: `UPDATE_CONTRACT=1 npx jest screen-composer.contract` (in `api/`), then re-run the native tests and `npm run test:frontend`.
- **Live preview:** the device settings page draws the composed screens on a 256x64 canvas (`react/feature/device/screen-preview`), fed by `POST /v1/devices/:uuid/screens/preview` with the unsaved form. Its row/countdown/alignment rules are a port of the firmware's; keep both in sync (the shared fixture test enforces it).

---

## Path Aliases

### Frontend (`frontend/tsconfig.json`)
- `@helpers/*` maps to `frontend/src/helpers/*`
- `@components/*` maps to `frontend/src/components/*`

### API (`api/tsconfig.json`)
- Relative imports from `src/modules/*`
