# GitHub Copilot Instructions — Public Transport Spy

This file provides project-specific context and development instructions for GitHub Copilot and AI coding agents.

## Project Overview

**Public Transport Spy** connects ESP32-based SSD1322 OLED displays with live Swiss transit information via a NestJS 11 backend API, PostgreSQL 18 database, and Next.js 16 web management dashboard.

---

## Tech Stack

- **Firmware (`on-chip-software/`):** C++ (Arduino Framework), PlatformIO, U8g2 (SSD1322 SPI), LittleFS, QRCode.
- **Backend API (`api/`):** NestJS 11, Node.js 24, TypeScript, TypeORM, PostgreSQL 18, Pino logger, Zod.
- **Web Frontend (`frontend/`):** Next.js 16 (App Router), React 19.3, Turbopack, Material UI 9, Tailwind CSS 4, Jose JWT.

---

## Key Invariants & Rules

1. **Security & Guarding:**
   - Protected API routes (`/v1/devices/*`, `/v1/auth/user/:userName`) require `AdminApiKeyGuard` (`X-Api-Key`).
   - The guard is fail-closed: if `ADMIN_API_KEY` is missing in server environment, return `401 Unauthorized`.
   - Browser clients must never receive `ADMIN_API_KEY`. The Next.js BFF server Route Handlers inject it server-side.
2. **Device Authentication:**
   - Unrecognized device UUIDs are never auto-registered — `GET /api/v1/device/config` returns `404`; a device only becomes known through a claimed pairing code, and its UUID (random per install) is never a credential on its own.
   - A device generates its own pairing code locally and only becomes known to the backend via `POST /api/v1/device/claim`, which requires an admin to have already claimed that code via `POST /v1/devices/pair`. That call issues the `X-Device-Token`.
   - All subsequent device requests (`/api/v1/device/config`, `/api/v1/device/screens`, `/api/v1/device/data`, `/api/v1/device/metrics`) must present the matching token.
   - Timing-safe comparison (`timingSafeEqual`) is mandatory.
3. **Firmware Constraints:**
   - Partition scheme is `huge_app.csv` (3.0 MB App partition, ~1.0 MB LittleFS).
   - Dynamic heap headroom must stay > 150 KB for SSL handshakes.
   - When offline, display cached `/screens.json` with an `[OFFLINE]` badge; never enter a reboot loop.

---

## Commands

```bash
# Run tests
npm run test:api

# Run builds
npm run build:api
npm run build:frontend
npm run firmware:build
```
