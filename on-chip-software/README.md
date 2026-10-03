# Public Transport Spy — ESP32 Firmware

Firmware for the ESP32 that drives the Public Transport Spy departure board: a 256×64 SSD1322 OLED that shows live departures composed by the backend.

The firmware is deliberately thin. **The backend decides what is on the screen** (`GET /api/v1/device/screens` returns positioned widgets), and the device fetches, caches, rotates and draws it. New layouts and features are almost always backend changes. See [How it works](#how-it-works) below and the full reference in [docs/on-chip-firmware.md](../docs/on-chip-firmware.md).

---

## Hardware

| Part | Requirement |
|---|---|
| Microcontroller | Any ESP32 (Xtensa LX6) board with 4 MB flash: ESP32 DevKit v1, NodeMCU-32S, ESP32-WROOM-32. Not ESP32-S2/S3/C3 (different pins and core). |
| Display | 256×64 OLED with **SSD1322** controller (e.g. 3.12" yellow/white modules), wired for **4-wire SPI** |
| Button | The board's **BOOT** button (GPIO 0). No extra parts needed |
| Power | 5 V USB adapter rated ≥ 1 A and a data-capable cable (Wi-Fi transmit peaks reach 250–400 mA; see the [Hardware Guide §5](../docs/hardware-guide.md#5-power)) |

> **Building one?** The [Hardware Guide](../docs/hardware-guide.md) covers what to check when buying the ESP32 and the display, setting the display to SPI, power (which pin feeds the display, brownouts), the enclosure and a troubleshooting table.

### Wiring (hardware SPI / VSPI)

| Display pin | ESP32 GPIO | Notes |
|---|---|---|
| `VCC` | `3.3V` or `5V` | Depends on the module: check whether it has an onboard regulator. Logic levels are always 3.3 V |
| `GND` | `GND` | Common ground |
| `DIN` / `MOSI` / `SDA` | `GPIO 23` | VSPI MOSI (fixed by the hardware SPI peripheral) |
| `CLK` / `SCK` / `SCL` | `GPIO 18` | VSPI clock (fixed by the hardware SPI peripheral) |
| `CS` | `GPIO 5` | Chip select, active low |
| `DC` | `GPIO 2` | Data / command |
| `RESET` | `GPIO 4` | Pulsed low by `u8g2.begin()` at boot |

There is no MISO: the display is write-only. The pins are set in one place, the U8g2 constructor in `src/display.cpp`.

### Hardware gotchas
- **Interface mode jumpers.** Many SSD1322 modules ship configured for 8080 parallel. Set the module's `BS0`/`BS1` jumpers or resistors to **4-wire SPI** (see the module's datasheet). The symptom of a wrong mode is a panel that stays black while the serial log looks normal.
- **Strapping pins.** GPIO 0, 2 and 5 are ESP32 boot-strapping pins:
  - GPIO 0 is the BOOT button. Holding it while pressing EN/RESET enters the USB download mode, which is how flashing works.
  - GPIO 2 (display `DC`) must not be held high at reset. The display input is high-impedance, so this works on standard devkits. If a board refuses to enter flash mode, hold BOOT while flashing or disconnect `DC`.
  - GPIO 5 (`CS`) idles high, which is the strapping default.
- **Burn-in.** OLED pixels age with use. The firmware shifts all content by a few pixels over time, dims at night (23:00–06:00 by default), and powers the panel off when the display is disabled or outside its schedule. Don't add static full-brightness elements that bypass `renderPage`.
- **Power-save vs. off.** "Display off" means U8g2 power-save (the panel goes dark, the ESP32 keeps running, polling and caching). The board itself is never put to sleep.

---

## How it works

### Boot to first pixel
1. `setup()` initializes the panel (`displayBegin()`) and mounts LittleFS. If mounting fails, the partition is formatted.
2. The radio is started **before** any random numbers are drawn: the ESP32 hardware RNG is only truly random with RF enabled. Then the device identity (`/id.txt`, random UUID v4) is loaded or created.
3. A saved token (`/token.txt`) means the device was paired before. The cached config and screens are loaded and shown immediately, even before Wi-Fi is up. Without a token, a 6-character pairing code is generated locally and shown with a QR code.
4. Saved Wi-Fi credentials: connect in the background with auto-reconnect. None: the setup portal `PTSpy-Setup-XXXX` opens and waits indefinitely.

### The main loop
`loop()` is non-blocking and runs about every 10 ms:

```
loop()
 ├─ handleButton()        BOOT: < 2 s portal, 3 s warning, 10 s factory reset
 ├─ wm.process()          setup portal, while open
 ├─ Wi-Fi state           re-checked every pass; reconnect triggers NTP + immediate backend calls
 ├─ tickClaiming()        never paired: POST /claim every 5 s
 │  or tickPolling()      paired: page rotation, GET /config + /screens every apiInterval,
 │                        early refetch when departures run out, POST /metrics
 └─ drawScreen()          every screenInterval (2 s on non-board screens)
     └─ display.cpp       renderPage / drawPairingScreen / drawWifiSetupScreen / drawMessage
```

The only blocking work is an HTTP request: up to 5 s connect plus 10 s read, longer for a TLS handshake. While a request runs, the screen and the button don't update. That is acceptable because requests are rare (minutes apart), but **never add long `delay()`s or loops that wait for something**. The device must also never reboot by itself: losing Wi-Fi or the backend only shows an `[OFFLINE]` badge over the cached departures. The single intentional reboot is the user's factory reset.

### Who decides what
| Concern | Where |
|---|---|
| What the pages look like (widgets, positions, fonts, texts, departures) | Backend: `api/src/modules/device/screens/screen-composer.ts` |
| Which screen is shown (pairing, Wi-Fi setup, board, message), contrast, panel on/off | `drawScreen()` in `src/main.cpp` |
| How pixels are drawn (fonts, truncation, alignment, QR, burn-in shift) | `src/display.cpp`. It reads no firmware state, only its parameters |
| Decisions that can be tested without hardware (status mapping, countdowns, row selection, schedule, button timing) | `include/device_logic.h`, `include/screen_logic.h` |

Departures carry absolute timestamps, so countdowns keep ticking correctly offline as long as the clock has been synced once (NTP after each Wi-Fi connect; until then the clock shows `--:--`).

### Source layout

| File | Responsibility |
|---|---|
| `src/main.cpp` | State machine (`Claiming`, `Unpaired`, `Disabled`, `Running`), Wi-Fi/portal/button, HTTP, pairing, config, screens fetch & cache, metrics, `drawScreen()` |
| `src/display.cpp`, `include/display.h` | Display engine: owns the U8g2 panel; widget renderer, pairing/QR, Wi-Fi setup and message screens |
| `include/device_logic.h`, `include/screen_logic.h` | Pure helpers (no Arduino headers), host-tested |
| `test/test_logic`, `test/test_contract` | Native unit tests, and the contract test that renders the backend-pinned `screens.fixture.json` |
| `certs/x509_crt_bundle.bin` | Mozilla root CAs embedded for HTTPS verification |
| `platformio.ini` | Envs `esp32dev` (dev), `esp32dev-retail` (customer), `native` (tests) |

### Storage
- **NVS** (ESP32 key-value flash, managed by WiFiManager) holds the Wi-Fi credentials.
- **LittleFS** holds everything else: `/id.txt`, `/token.txt`, `/server.txt`, `/config.json` and `/screens.json`.

LittleFS is power-loss safe (copy-on-write), which matters because owners unplug the board at any time. A factory reset erases both.

---

## Developing

### Build, flash, monitor (PlatformIO, recommended)
```bash
pip install -r requirements.txt     # pinned PlatformIO, same as CI
cd on-chip-software
pio run                             # build esp32dev
pio run -t upload                   # flash over USB (921600 baud)
pio device monitor                  # serial log at 115200, crash backtraces decoded
pio test -e native                  # host tests, no board needed
```
From the repo root: `npm run firmware:build` and `npm run firmware:upload`.

Retail build, with the backend URL baked in and no URL field in the portal. It fails to compile if either variable is missing:
```bash
PTS_BACKEND_URL=https://api.example.com PTS_FIRMWARE_VERSION=1.0.0 pio run -e esp32dev-retail
```

### Local backend
In a dev build the setup portal has a **Backend API Base URL** field. Enter your machine's LAN address, e.g. `http://192.168.1.100:7778` (not `localhost`, which would be the ESP32 itself). It is stored in `/server.txt`. Plain `http://` is fine on the LAN. `https://` must use a certificate from a public CA, because self-signed certificates fail with `Server unreachable (-1)`.

### Rules of thumb
- **Layout changes go into the backend composer**, not the firmware. The widget contract (`text`, `clock`, `line`, `status`, `list`) is additive: the firmware skips unknown widget types and fonts, so older devices survive newer backends. Contract details: [docs/api-reference.md §2.2a](../docs/api-reference.md).
- **Prefer a server-sent config field over a new constant.** Units in the field can't be reflashed easily (there is no OTA, see below). The tiers of fixed vs. variable values are in [docs/on-chip-firmware.md §8](../docs/on-chip-firmware.md#8-configuration-reference-fixed-vs-variable); keep that table in sync.
- **Put logic you can test without hardware into `include/*_logic.h`** with a native test. Keep `display.cpp` free of firmware state.
- **Renderer changes have a twin** in the web live preview (`frontend/src/react/feature/device/screen-preview`). The shared fixture test keeps them in sync. After an intended composer change, run `UPDATE_CONTRACT=1 npx jest screen-composer.contract` in `api/`, then `pio test -e native` and `npm run test:frontend`.
- **Watch the memory.** The build's `RAM:` line (about 51 KB) is *static* memory. The heap that HTTPS needs is reported at runtime by the device metrics (`ramFreeBytes`, `ramMinFreeEver`, `ramMaxAllocBlock`, admin telemetry page). A TLS handshake needs roughly 40–50 KB of contiguous heap. Avoid large static buffers and keep `JsonDocument`s short-lived.
- **No OTA.** The `huge_app.csv` partition table has a single 3 MB app slot, so firmware updates need USB. Adding OTA means switching to a two-slot table, which halves the app space.

### Arduino IDE
Not supported. The HTTPS root CA bundle is linked in through PlatformIO's `board_build.embed_files` (symbol `rootca_crt_bundle_start`), so an Arduino IDE sketch fails to link. Use PlatformIO, either the CLI above or the VS Code extension.

---

## Flash & Memory Footprint

The CI firmware-stats workflow measures every build. Snapshot (`esp32dev`):

| Resource | Used | Of | Notes |
|---|---|---|---|
| Flash (app0) | ~1.22 MB | 3.0 MB (38.8%) | target: under 50% |
| Static RAM (`.data` + `.bss`) | ~51.6 KB | 320 KB DRAM (15.8%) | the build's `RAM:` line; target: under ~55 KB |
| LittleFS | < 10 KB | 896 KB | five small text/JSON files (a screens cache is ~5 KB) |

---

## First Boot (owner's view)

1. **Power on.** Without saved Wi-Fi the OLED shows `Wi-Fi Setup` and the network `PTSpy-Setup-XXXX`. The portal does not time out.
2. **Join the network** with a phone. The setup page opens automatically (otherwise go to `http://192.168.4.1`). Enter the Wi-Fi credentials (and, in dev builds, the backend URL), then **Save**.
3. **Pair.** The display shows a code like `KV7-9P2` and a QR code that opens the web app's pairing page (`PUBLIC_APP_URL/pair?code=...`). Alternatively, enter the code in the app. The status line reads `Enter this code in the app`, `Server unreachable (code)`, `Code expired - use the new code` or `Registered to another account`.
4. **Customize** in the web app under the display's settings → **Screens** (up to 6 rotating pages).
5. **Run.** Departures appear within about 5 s of pairing. Changes in the app apply within one refresh interval, with no reboot. Without Wi-Fi the cached departures stay up with an `[OFFLINE]` badge.

**BOOT button:** short press opens the setup portal again (closes after 5 min if unused). Hold 3 s for a warning, and keep holding to 10 s for a factory reset, which erases Wi-Fi, pairing and the identity. Releasing early cancels.
