# On-Chip Firmware Guide

This document describes the firmware architecture, hardware schematic, flashing procedure, and memory layout for the ESP32 on-chip client located in [`on-chip-software/`](../on-chip-software/). Choosing a board and display, the interface jumpers, power and troubleshooting are covered in the [Hardware Guide](hardware-guide.md).

---

## 1. Hardware Specifications

- **SoC:** Espressif ESP32-D0WD-V3 (Dual-core Xtensa LX6 @ 240 MHz, 520 KB SRAM, 4 MB SPI Flash).
- **Display:** 256x64 monochromatic OLED panel based on the Solomon Systech **SSD1322** controller.
- **Interface:** 4-Wire Hardware SPI (Clock speeds up to 10–20 MHz supported by ESP32 VSPI peripheral).
- **Storage:** On-chip LittleFS partition for offline caching and configuration persistence.

---

## 2. Wiring & Pinout (Hardware SPI)

The display engine (`src/display.cpp`) configures the ESP32 VSPI bus directly using the U8g2 driver constructor:
```cpp
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, /* cs=*/ 5, /* dc=*/ 2, /* reset=*/ 4);
```

| Display Pin | ESP32 Pin | Function | Notes |
|---|---|---|---|
| **VCC** | `3.3V` / `5V` | Power Supply | Check whether your display module has an onboard 3.3V regulator. |
| **GND** | `GND` | Ground | Common system ground. |
| **DIN / MOSI** | `GPIO 23` | VSPI Data Out | Master Out Slave In. |
| **CLK / SCK** | `GPIO 18` | VSPI Clock | SPI Serial Clock. |
| **CS** | `GPIO 5` | Chip Select | Active low; asserted during SPI frame transfer. |
| **DC** | `GPIO 2` | Data / Command | Low = Command register, High = Display RAM data. |
| **RESET** | `GPIO 4` | Hardware Reset | Pulsed low during initialization in `u8g2.begin()`. |

> [!NOTE]
> `GPIO 0` (BOOT button), `GPIO 2` (`DC`) and `GPIO 5` (`CS`) are ESP32 strapping pins. `GPIO 2` must not be held high at reset, or the chip won't enter download mode. It works on standard devkits because the display input is high-impedance at startup. If a board refuses to flash, hold BOOT or disconnect `DC`. `GPIO 5` idles high, which is its strapping default.

**Bus & frame:** U8g2 drives the SSD1322 at 10 MHz, SPI mode 0. The full-frame buffer (`_F_`) is 1 bit per pixel (2 KB of RAM), and U8g2 expands it to the controller's 4-bit grayscale on transfer. A `sendBuffer()` therefore pushes 8 KB, about 7 ms. There is no MISO: the panel is write-only.

**Interface mode:** many SSD1322 modules ship configured for 8080 parallel. Set the module's `BS0`/`BS1` jumpers or resistors to 4-wire SPI. A wrong mode shows as a black panel with a normal serial log.

---

## 3. Flash Memory Budget & Partition Layout (`huge_app.csv`)

The ESP32 firmware links against mbedTLS, WiFiClientSecure, ArduinoJson, WiFiManager, U8g2, and QRCode.

### Memory & Flash Budget
Measured on every build by the CI firmware-stats workflow. Snapshot (`esp32dev`):

| Resource | Used | Available | Target |
| :--- | :--- | :--- | :--- |
| **Flash (`app0`)** | ~1.22 MB | 3.0 MB (38.8%) | under 50% |
| **Static RAM** (`.data` + `.bss`, the build's `RAM:` line) | ~51.6 KB | 320 KB DRAM (15.8%) | under ~55 KB |
| **Heap at runtime** | reported by the device: `ramFreeBytes`, `ramMinFreeEver`, `ramMaxAllocBlock` (admin telemetry) | | keep enough contiguous heap for a TLS handshake (roughly 40–50 KB) |
| **LittleFS** | < 10 KB (five small files; a screens cache is ~5 KB) | 896 KB | |

The build's `RAM:` figure is static allocation only. What actually runs out first is **contiguous heap** during an HTTPS handshake, so watch `ramMaxAllocBlock` in the metrics after changes that allocate (large `JsonDocument`s, `String` concatenation in loops, static buffers).

The default ESP32 partition table allocates only 1.25 MB per app slot. The project uses the built-in `huge_app.csv` layout (Arduino core 2.0.x):

```csv
# Name,   Type, SubType, Offset,  Size
nvs,      data, nvs,     0x9000,  0x5000     # Wi-Fi credentials (WiFiManager)
otadata,  data, ota,     0xe000,  0x2000
app0,     app,  ota_0,   0x10000, 0x300000   # 3.0 MB application
spiffs,   data, spiffs,  0x310000,0xE0000    # 896 KB, mounted as LittleFS
coredump, data, coredump,0x3F0000,0x10000
```

> [!IMPORTANT]
> There is only **one app slot**, so the firmware cannot update itself over the air. Updates need USB. Adding OTA means switching to a two-slot table (about 1.9 MB per slot at most), so keep the flash target in mind.

---

## 4. LittleFS On-Chip Storage Layout

The firmware utilizes LittleFS for robust non-volatile storage:

- **`/id.txt`**: The device's random identity (RFC 4122 v4 UUID from the hardware RNG, generated on first boot). Deleted by a factory reset, so a resold unit gets a fresh identity.
- **`/server.txt`**: Stores the user-configured backend base URL entered via the captive portal (e.g. `http://192.168.1.100:7778` or `https://api.my-domain.com`).
- **`/token.txt`**: Stores the secret per-device authentication token (`X-Device-Token`) issued by the backend once a pairing code is claimed.
- **`/config.json`**: Caches the latest device settings (`stationName`, `timezone`, `theme`, intervals, `isPaired`) received from `/api/v1/device/config`.
- **`/screens.json`**: Caches the last composed screen layout from `GET /api/v1/device/screens` (pages, widgets, departure timestamps), so pages keep rotating and countdowns keep ticking when Wi-Fi is lost.

---

## 5. Firmware Architecture & Lifecycle

The firmware is split into two translation units:

| File | Responsibility |
|---|---|
| `src/main.cpp` | State machine (`enum class State`), Wi-Fi/portal/button, HTTP, claiming, config, screens fetch & cache, metrics, and `drawScreen()`, which picks the screen, the contrast (day/night) and panel power for the current state |
| `src/display.cpp` (`include/display.h`) | Display engine: owns the U8g2 panel, renders a page of widgets (`renderPage`), the pairing screen with QR, the Wi-Fi setup screen and messages. It reads no firmware globals; everything comes in as parameters |
| `include/device_logic.h`, `include/screen_logic.h` | Pure, host-tested helpers shared by both (and by the native tests) |

The firmware is a small state machine (`enum class State` in `main.cpp`). Wi-Fi is handled separately and re-checked on every loop pass, so the device recovers by itself when the router comes back. It never reboots for this.

`loop()` is non-blocking and yields 10 ms per pass. The only blocking work is an HTTP request (5 s connect + 10 s read timeout, longer during a TLS handshake), during which the screen and the button don't update. Never add long `delay()`s or wait loops: the button, the setup portal and the redraw timers all depend on `loop()` coming round.

```
[Power On]
   |  LittleFS, random device ID (/id.txt), saved backend URL, token
   |  Wi-Fi saved?  yes -> WiFi.begin() (auto-reconnect)   no -> setup portal "PTSpy-Setup-xxxx" (no timeout)
   v
 token in /token.txt?
   |-- no  --> CLAIMING
   |            - 6-char code generated locally (esp_random), shown with QR -> PUBLIC_APP_URL/pair?code=...
   |              (QR base URL from GET /api/v1/device/hello)
   |            - POST /api/v1/device/claim every 5 s
   |                200 -> token saved -> RUNNING
   |                400/409 -> new code      404 -> "Enter this code in the app"
   |                403 -> "Registered to another account" (keeps polling until the owner releases it)
   |                network error/5xx -> "Server unreachable (code)"
   |
   '-- yes --> RUNNING (cached config + departures shown immediately)
                every apiInterval: GET /api/v1/device/config, then GET /api/v1/device/screens
                  200 + isPaired:false -> UNPAIRED (shows backend-issued code, polls every 5 s)
                  403                  -> DISABLED (OLED powered down, keeps polling)
                outside config `schedule` window -> OLED powered down, keeps running
                  401/404 x3 in a row  -> token/config/cache deleted -> CLAIMING
                  network error        -> keep cached departures, [OFFLINE] badge
                early refetch when fewer than 3 upcoming departures remain (max every 30 s)
                every metricsInterval: POST /api/v1/device/metrics (includes firmwareVersion)
```

Config changes made in the app (station, theme, timezone, intervals, unpair, disable) apply within one `apiInterval`, with no reboot.

### Button (BOOT / GPIO 0)
- **Short press (< 2 s):** opens the Wi-Fi setup portal (closes after 5 min if unused) to change Wi-Fi or the backend URL.
- **Hold 3 s:** the screen warns "Keep holding 10 s to factory reset"; releasing cancels.
- **Hold 10 s:** factory reset. Erases Wi-Fi credentials and LittleFS (identity, token, caches) and reboots into setup.

### Display
- Text is drawn with `drawUTF8` (umlauts render correctly) and truncated per column on whole characters.
- Until NTP has synced, the clock shows `--:--` and countdowns show `--`.
- Burn-in protection: the content shifts by up to 2 px over time, and contrast drops at night (`nightContrast` 16 from 23:00 to 06:00 by default).
- Power: a disabled display (403) and the time outside its `schedule` window keep the OLED in power-save (dark). Messages like the factory-reset warning wake it.
- Which display values the server can change is listed in [§8 Configuration Reference](#8-configuration-reference-fixed-vs-variable).

### Build variants
| Env | Backend URL | Portal URL field | Use |
|---|---|---|---|
| `esp32dev` | `http://192.168.1.100:7778` default, editable in the portal | shown | development |
| `esp32dev-retail` | baked in from `PTS_BACKEND_URL` | hidden | units sold to customers |

```bash
PTS_BACKEND_URL=https://api.example.com PTS_FIRMWARE_VERSION=1.0.0 pio run -e esp32dev-retail
```
The build fails (static_assert) if either variable is missing.

Pure decision logic lives in `include/device_logic.h` and `include/screen_logic.h` and is unit-tested on the host: `pio test -e native`. Drawing code belongs in `src/display.cpp`; keep it free of firmware state so the state machine stays the only place that decides what is shown.

### QR Code Rendering Engine
The SSD1322 OLED display has a resolution of 256x64 pixels:
- **QR Code Version**: Version 3 (29x29 modules, up to 53 characters in Byte mode with ECC_LOW).
- **Pixel Scaling**: 2x2 pixels per module = 58x58 pixels.
- **Placement**: Centered vertically with a 3px margin (`y: 3..61`), left offset (`x: 3..61`).
- **Right Panel (`x: 72..255`)**: Displays `PAIR DEVICE` header, the hyphenated 6-character code in bold 12pt font, and pairing status text.

### Random Device Identity
On first boot the device generates a random RFC 4122 v4 UUID with the hardware RNG (after the radio is started, so the RNG is truly random) and stores it in `/id.txt`. It is deliberately **not** derived from the MAC address, because the MAC is broadcast over Wi-Fi and therefore guessable. The UUID is an identifier, not a secret: requests are authenticated by the `X-Device-Token` issued at claim time. A factory reset generates a new identity.

---

## 6. Building & Flashing with PlatformIO

### Prerequisites
PlatformIO Core is installed on your workstation (`pio`).

### Compile Firmware
```bash
cd on-chip-software
pio run
```

### Flash to ESP32 over USB
Connect your ESP32 board to the computer using a micro-USB / USB-C data cable:
```bash
cd on-chip-software
pio run -t upload
```

### Serial Monitor
```bash
pio device monitor --speed 115200
```
The `esp32_exception_decoder` filter (set in `platformio.ini`) turns crash backtraces into file and line numbers.

### Arduino IDE
Not supported: the CA bundle is linked in via PlatformIO's `board_build.embed_files` (`rootca_crt_bundle_start`), so an Arduino IDE sketch fails to link.

---

## 7. HTTPS Certificate Verification

HTTPS requests are verified against the Mozilla root CA bundle embedded in the firmware (`on-chip-software/certs/x509_crt_bundle.bin`, about 63 KB, 135 roots). Any certificate from a public CA (Let's Encrypt, etc.) works, so the backend can change hosts or certificate vendors without a firmware update. Self-signed certificates are rejected (the device shows `Server unreachable (-1)`). Plain `http://` stays available for LAN development.

Regenerate the bundle (ESP-IDF v4.4 tooling, matching Arduino core 2.0.x):
```bash
cd on-chip-software/certs
curl -fsSLO https://raw.githubusercontent.com/espressif/esp-idf/v4.4.8/components/mbedtls/esp_crt_bundle/cacrt_all.pem
python3 -m venv /tmp/crt && /tmp/crt/bin/pip install cryptography
/tmp/crt/bin/python gen_crt_bundle.py --input cacrt_all.pem && mv x509_crt_bundle x509_crt_bundle.bin
```

---

## 8. Configuration Reference: Fixed vs. Variable

Units are sold to the public, so every value falls into one of four tiers, depending on what it takes to change it. Prefer moving a value **up** this list (toward server-controlled) rather than adding new hardcoded constants.

### 8.1 Server-controlled at runtime (no reflash, applied within one `apiInterval`)

Sent by the backend in `GET /api/v1/device/config` (and the claim response). Values outside the clamp range are clamped. Missing fields fall back to the default, so older backends stay compatible.

| Field | Default | Clamp / range | Effect | Sent by backend today? |
|---|---|---|---|---|
| `stationName` | `""` | n/a | Reported in metrics (on screen, the header comes from `/screens`) | yes (device settings) |
| `timezone` | `CET-1CEST,M3.5.0,M10.5.0/3` | POSIX TZ string (the API converts the device's IANA zone, e.g. `Europe/London`) | Clock, night window, schedule | yes |
| `schedule` | absent = always on | `{on, off}` 0–1439 min, `days` 1–127 (bit 0 = Sunday) | Daily on/off window; outside it the OLED is powered down (`setPowerSave`) | when enabled in the app |
| `theme` | `standard` | `standard` \| `retro` \| `bold` | Fonts picked by the backend's screen composer | yes (applied server-side) |
| `apiInterval` | 300 000 ms | 5 000 – 3 600 000 | Config + departures refresh | yes (5 000 while unpaired) |
| `screenInterval` | 15 000 ms | 1 000 – 60 000 | Countdown redraw | yes |
| `metricsInterval` | 600 000 ms | 60 000 – 86 400 000 | Telemetry upload | yes |
| `isPaired`, `pairingCode`, `pairingUrl` | n/a | n/a | Running vs. unpaired screen, QR link | yes |
| `deviceToken` | n/a | n/a | Auth credential (saved to `/token.txt`) | yes |
| `backendBaseUrl` | not sent | http(s), < 128 chars, must answer `/hello` | Permanently moves the device to a new API base URL | only if `DEVICE_BACKEND_URL` is set |
| `contrast` | 255 | 0 – 255 | Daytime OLED brightness | **no** (firmware ready, backend column/UI not built yet) |
| `nightContrast` | 16 | 0 – 255 | Night OLED brightness | **no** |
| `nightFrom` / `nightTo` | 23 / 6 | local hours; equal = night mode off | Night window | **no** |

**The entire screen content is server-driven** via `GET /api/v1/device/screens` (see [API reference §2.2a](api-reference.md#22a-get-screens-customizable-display)): which pages rotate and for how long, every widget's position, font and text, header, rows (1–4), columns (countdown or departure time, line, platform, destination, delay), stations per page, line/type/direction filters and walking time. Owners edit this per device in the web app (Device settings → Screens); new page types are backend-only changes as long as they use the existing widgets.

Also server-driven: the QR target (`GET /hello` → `pairBaseUrl` = backend env `PUBLIC_APP_URL`), and HTTP status semantics (403 = disabled, 401/404 = token rejected).

### 8.2 Set on the device by the owner (setup portal / BOOT button)

| Value | How | Stored in |
|---|---|---|
| Wi-Fi SSID + password | Setup portal (first boot, or short BOOT press) | ESP32 NVS (WiFiManager) |
| Backend base URL | Setup portal, **dev builds only** (`SHOW_BACKEND_URL_FIELD`) | `/server.txt` |
| Factory reset | Hold BOOT 10 s | erases NVS Wi-Fi + all of LittleFS |

Generated on the device: the identity (`/id.txt`, random UUID) and the pairing code (random, 6 chars).

### 8.3 Build-time (per firmware build, `platformio.ini`)

| Flag | Dev (`esp32dev`) | Retail (`esp32dev-retail`) |
|---|---|---|
| `BACKEND_URL` | `http://192.168.1.100:7778` | `$PTS_BACKEND_URL` (required) |
| `FIRMWARE_VERSION` | `dev` | `$PTS_FIRMWARE_VERSION` (required; reported in metrics) |
| `SHOW_BACKEND_URL_FIELD` | on | off |
| `CORE_DEBUG_LEVEL` | 3 | 1 |
| CA bundle | `certs/x509_crt_bundle.bin` (Mozilla roots) | same |
| Partition table | `huge_app.csv` (single app slot, no OTA) | same |

### 8.4 Hardcoded (changing these needs new firmware)

**API contract**
| Value | Where |
|---|---|
| Path prefix `/api/v1/device` + routes `/hello`, `/claim`, `/config`, `/screens`, `/metrics` (the backend's `/data` is not used by this firmware) | `DEVICE_API`, `main.cpp` |
| Headers `X-Device-ID`, `X-Device-Token`; JSON field names above | `httpRequest`, `applyConfig`, `fetchConfiguration`, `loadScreens`, `sendMetrics` |
| Status mapping: claim 200 / 400+409 (new code) / 403 (registered to another account, keep polling) / other (retry); config 200 / 401+404 (auth) / 403 (disabled) / other (transient) | `device_logic.h` |

**Timing & resilience**
| Value | Where |
|---|---|
| Claim poll every 5 s; `/hello` retry every 30 s | `tickClaiming` |
| 3 consecutive 401/404 before returning to pairing mode | `AUTH_FAILURES_BEFORE_RESET` |
| Early departure refetch when fewer than 3 upcoming and the last fetch was full, at most every 30 s | `shouldFetchEarly` |
| HTTP connect timeout 5 s, read timeout 10 s | `httpRequest` |
| Wi-Fi connect timeout 20 s; portal timeout none (no Wi-Fi saved) / 300 s (button-opened) | `setup`, `openPortal` |
| Non-running screens redraw every 2 s; `loop()` yields 10 ms per pass | `loop` |
| Clock counts as synced after 2023-11-14 (epoch 1 700 000 000) | `isTimeValid` |
| NTP servers `pool.ntp.org`, `time.google.com` | `onWifiConnected` |
| Interval clamp ranges (see 8.1) | `applyConfig` |

**Display** (the layout itself is server-driven; these are the renderer's fixed capabilities)
| Value | Where |
|---|---|
| Widget vocabulary `text`, `clock`, `line`, `status`, `list`; list column kinds `countdown`, `time`, text | `renderPage` (`display.cpp`), `screen_logic.h` |
| Font set: `small` 5x7, `regular` helvR08, `bold` helvB08, `medium` helvB10, `large` helvB12, `xl` helvB24, `retro` PressStart2P | `fontFor` (`display.cpp`) |
| Limits: 6 pages, 24 widgets/page, 10 list items (the backend also caps cell text at 28 characters); page duration clamped 2 s – 5 min | `device_logic.h`, `pageDurationMs` |
| Row rules: hidden > 59 s after departure or within `leadSec`; `Now` for the current minute | `listItemVisible`, `formatCountdown` |
| Burn-in shift: up to 2 px horizontally every 5 min, 1 px vertically every 15 min | `renderPage` (`display.cpp`) |
| UI texts (English only): "PAIR DEVICE", "Wi-Fi Setup", "[OFFLINE]", "Loading departures...", status lines | `display.cpp`; state-dependent status lines in `main.cpp` |
| QR: version 3–5, ECC low, left 64 px | `drawQr` (`display.cpp`) |

**Device & hardware**
| Value | Where |
|---|---|
| SSD1322 256×64 on HW SPI, CS 5 / DC 2 / RESET 4 | `u8g2` constructor (`display.cpp`) |
| BOOT button GPIO 0: < 2 s portal, 3 s warning, 10 s factory reset | `BUTTON_PIN`, `buttonActionFor` |
| Setup network name `PTSpy-Setup-<first 4 of UUID>`, open (no password) | `apName` |
| Pairing code: 6 chars from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` | `newPairingCode` |
| LittleFS files `/id.txt`, `/token.txt`, `/server.txt`, `/config.json`, `/screens.json` | top of `main.cpp` |
| Fallback timezone `CET-1CEST,M3.5.0,M10.5.0/3` | `DEFAULT_TZ` |

**Good candidates to move up to 8.1 later** (each is a small additive config field or widget, no v2 needed): night/brightness (backend side only), claim/poll timings, UI language of the built-in screens, auth-failure threshold, an `image`/icon widget.

