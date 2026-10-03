# Public Transport Spy — Documentation

Comprehensive documentation for the **Public Transport Spy** platform, connecting ESP32-based desktop and wall-mounted OLED departure boards with a modular NestJS backend API, a Next.js web dashboard, and live Swiss Public Transport data.

## Table of Contents

- [System Architecture](architecture.md) — Three-tier monorepo topology, sequence diagrams, session authentication, device lifecycle, security threat model, and caching strategies.
- [API Reference](api-reference.md) — Complete REST specification for hardware client endpoints (`/api/v1/device/*`), transit lookups (`/v1/transit/*`), user authentication (`/v1/auth/*`), administrative device management (`/v1/devices/*`), and the Frontend BFF.
- [Hardware Guide](hardware-guide.md) — Choosing an ESP32 board and SSD1322 display, wiring, power budget and brownouts, enclosure, first power-on checklist and troubleshooting.
- [On-Chip Firmware Guide](on-chip-firmware.md) — ESP32 wiring, SSD1322 OLED pinout, captive portal, LittleFS offline fallback, QR code display, memory budgets, and PlatformIO compilation/flashing.
- [Deployment & Operations](deployment.md) — Docker Compose instructions, environment configuration, database migrations, and local development workflows.
- [Testing Guide](testing.md) — Test layers (unit, end-to-end, database-to-API integration on PostgreSQL 18, web logic, firmware), how to run them locally and in CI.

---

## Quick Navigation

| Document | Primary Audience | Description |
|---|---|---|
| [`architecture.md`](architecture.md) | Developers, Architects | High-level component topology, sequence diagrams, failure recovery, token lifecycle, and cache invalidation. |
| [`api-reference.md`](api-reference.md) | Backend Devs, Hardware Integrators, Web Devs | REST API endpoints, HTTP headers (`X-Device-ID`, `X-Device-Token`, `X-Api-Key`), payloads, and Swagger documentation. |
| [`hardware-guide.md`](hardware-guide.md) | Makers, Hardware Integrators | What to buy, display interface jumpers, wiring, powering the board and display, enclosure, troubleshooting. |
| [`on-chip-firmware.md`](on-chip-firmware.md) | Embedded Engineers, Makers | ESP32 microcontroller setup, SSD1322 SPI wiring, Wi-Fi captive portal, QR code rendering, and PlatformIO toolchain. |
| [`deployment.md`](deployment.md) | DevOps, System Operators | Docker Compose setup, PostgreSQL migrations, environment variables, and local development scripts. |
| [`testing.md`](testing.md) | All developers | Which suite proves what, the integration-test harness, CI, and the cross-stack contract fixture. |
