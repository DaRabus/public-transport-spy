# Public Transport Spy

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) ![ESP32](https://img.shields.io/badge/ESP32-PlatformIO-blue) ![NestJS](https://img.shields.io/badge/NestJS-11-e0234e) ![Next.js](https://img.shields.io/badge/Next.js-16-black)

**An open-source DIY live public transport departure board: ESP32 + SSD1322 OLED, self-hosted, for your desk or hallway wall.** An ESP32 drives a 256×64 OLED that shows the next trams, buses and trains at the stop you care about, with live countdowns. You design what it shows from a web dashboard, no reflashing needed.

- **Cheap and buildable:** an ESP32 dev board, one SSD1322 OLED, seven jumper wires. A printable case is included.
- **Zero-config for the device:** it joins your Wi-Fi through a setup portal, shows a QR code, and you pair it by scanning it with your phone.
- **Layouts live on the server:** pick stations, rotate up to 6 pages, filter lines, set a night schedule and time zone, and watch a live preview of the exact 256×64 pixels before saving.
- **Keeps working offline:** if Wi-Fi drops, the last departures stay on screen with an `[OFFLINE]` badge. The board never invents departures.
- **You own your data:** one `docker compose up` runs the whole backend. No cloud account, no tracking.

> **Data coverage:** departures come from the free Swiss [transport.opendata.ch](https://transport.opendata.ch) API, so stations are Swiss: trains of the [SBB](https://de.wikipedia.org/wiki/Schweizerische_Bundesbahnen) (Schweizerische Bundesbahnen, also CFF / FFS, Swiss Federal Railways) plus trams, buses, boats and cable cars of the other Swiss operators. Not affiliated with the SBB. Supporting another region means adding a provider in `api/src/modules/transit/`. Contributions welcome.

## How it fits together

```
 ESP32 + OLED  ──HTTPS──▶  NestJS API  ──▶  transport.opendata.ch
  (renders)                (composes screens,   PostgreSQL 18
                            owns the data)
                               ▲
 Phone / browser ──▶ Next.js dashboard (pairing, settings, live preview)
```

The firmware is deliberately thin: the backend composes positioned widgets, the ESP32 fetches, caches and draws them. So new layouts are almost always a backend change. Details: [docs/architecture.md](docs/architecture.md).

## Build your own

You need three things: the parts, a machine to run the backend, and about an hour.

### 1. Get the parts and wire the display
Shopping list, what to check before buying (the display must be an **SSD1322** and be switched to 4-wire SPI), wiring, power and the printable case are in the **[Hardware Guide](docs/hardware-guide.md)**. The 3D models are in [`hardware/housing/`](hardware/housing).

![Wiring diagram](docs/images/wiring-diagram.svg)

### 2. Start the backend
Requires Docker.

```bash
git clone https://github.com/DaRabus/public-transport-spy.git
cd public-transport-spy
cp .env.example .env     # then fill ADMIN_API_KEY and SESSION_SECRET with `openssl rand -hex 32`
                         # and set PUBLIC_APP_URL to this machine's LAN IP, e.g. http://192.168.1.20:7777
docker compose up --build -d
```

Dashboard: <http://localhost:7777> (create an account first). API docs: <http://localhost:7778/docs>. For a public server, put it behind HTTPS; see [Deployment](docs/deployment.md).

### 3. Flash the ESP32
Install [PlatformIO](https://platformio.org/install/cli), plug in the board and run:

```bash
npm install
npm run firmware:upload
```

### 4. Pair it
1. The display shows `Wi-Fi Setup`. Join the `PTSpy-Setup-XXXX` network with your phone and enter your Wi-Fi password and the backend address (`http://<your-LAN-IP>:7778`, not `localhost`).
2. The display now shows a QR code and a 6-character code. Scan the QR code (or type the code at `/pair`) while logged in to the dashboard.
3. Pick your station in the display's settings. Departures show up within seconds.

The BOOT button reopens the Wi-Fi setup (short press) or factory-resets the board (hold 10 s). More in the [firmware README](on-chip-software/README.md).

## Repository layout

| Folder | What it is |
|---|---|
| [`on-chip-software/`](on-chip-software/) | ESP32 firmware (C++, PlatformIO, U8g2, LittleFS) |
| [`api/`](api/) | NestJS 11 backend, TypeORM, PostgreSQL 18 |
| [`frontend/`](frontend/) | Next.js 16 dashboard (also the BFF that keeps the admin key off the browser) |
| [`hardware/`](hardware/) | Printable enclosure (OpenSCAD source + STL) |
| [`docs/`](docs/) | Architecture, API reference, hardware, firmware, deployment, testing |

## Hacking on it

```bash
npm install
cp .env.example .env && cp api/.env.example api/.env && cp frontend/.env.example frontend/.env
docker compose up -d pts-postgres
npm run dev:api          # http://localhost:7778
npm run dev:frontend     # http://localhost:7777
(cd api && npm run seed) # optional demo users and displays (password: password123)
```

Run `npm run test:api`, `npm run test:frontend` and `npm run test:integration` before a PR. The full workflow, test layers and the rules that keep API, dashboard and firmware compatible are in [CONTRIBUTING.md](CONTRIBUTING.md), [docs/testing.md](docs/testing.md) and [CLAUDE.md](CLAUDE.md).

## Documentation

| Read this | If you want to |
|---|---|
| [Hardware Guide](docs/hardware-guide.md) | buy parts, wire, power and house the display |
| [Firmware README](on-chip-software/README.md) and [Firmware Guide](docs/on-chip-firmware.md) | understand, build or change the ESP32 code |
| [Deployment](docs/deployment.md) | configure, migrate and run the stack |
| [Architecture](docs/architecture.md) | see how pairing, auth and caching work |
| [API Reference](docs/api-reference.md) | integrate with or extend the API |
| [Testing](docs/testing.md) | know what each test suite proves |
| [Security policy](SECURITY.md) | report a vulnerability or harden an instance |

## Credits and license

Released under the [MIT License](LICENSE). Timetable data © the respective Swiss transport operators, served by [transport.opendata.ch](https://transport.opendata.ch) (please respect its fair-use limits; the backend caches responses for that reason). Built on [U8g2](https://github.com/olikraus/u8g2), [WiFiManager](https://github.com/tzapu/WiFiManager), NestJS, Next.js and Material UI.

The `agents/`, `AGENTS.md` and `CLAUDE.md` files are guides for AI coding assistants working on this repo; humans may find them a handy contributor cheat sheet too.
