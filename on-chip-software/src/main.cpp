#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <time.h>
#include <esp_system.h>
#include "device_logic.h"
#include "screen_logic.h"
#include "display.h"

// Mozilla root CA bundle (certs/x509_crt_bundle.bin, embedded by platformio.ini): verifies any public CA,
// so the backend can move hosts or certificate vendors without a firmware update.
extern const uint8_t rootca_crt_bundle_start[] asm("_binary_certs_x509_crt_bundle_bin_start");

// Build-time defaults; retail builds inject these from the environment (see platformio.ini).
#ifndef BACKEND_URL
#define BACKEND_URL "http://192.168.1.100:7778"
#endif
#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "dev"
#endif
// Every device route lives under this versioned prefix. A breaking API change ships as /api/v2/device on
// the backend while this firmware keeps talking to v1.
#define DEVICE_API "/api/v1/device"

static_assert(sizeof(BACKEND_URL) > 1, "BACKEND_URL is empty: set PTS_BACKEND_URL for retail builds");
static_assert(sizeof(FIRMWARE_VERSION) > 1, "FIRMWARE_VERSION is empty: set PTS_FIRMWARE_VERSION for retail builds");

const int BUTTON_PIN = 0;  // BOOT button on standard ESP32 devkits, active low
const char* DEFAULT_TZ = "CET-1CEST,M3.5.0,M10.5.0/3";

const char* cacheFile = "/screens.json";  // last composed screen layout, for offline use
const char* configFile = "/config.json";
const char* serverConfigFile = "/server.txt";
const char* tokenConfigFile = "/token.txt";
const char* idFile = "/id.txt";

// Claiming: no token yet; shows a locally generated code and polls <DEVICE_API>/claim.
// Unpaired: has a token but the owner unpaired it; shows the backend-issued code.
// Disabled: the owner switched the display off (backend answers 403).
// Running:  normal departure board.
enum class State { Claiming, Unpaired, Disabled, Running };
State state = State::Claiming;

char backendBaseUrl[128] = BACKEND_URL;
String deviceUUID = "";
String deviceToken = "";
String pairingCode = "";
String pairingUrl = "";
String pairBaseUrl = "";  // from GET <DEVICE_API>/hello, e.g. https://app.example.com/pair
String statusLine = "";
bool isOffline = true;    // Wi-Fi state, re-evaluated every loop
bool serverOk = false;    // last backend call succeeded
bool portalOpen = false;
bool holdHint = false;
int authFailures = 0;

String stationName = "";
String timezoneString = "";
unsigned long apiInterval = 300000;
unsigned long screenInterval = 15000;
unsigned long metricsInterval = 600000;
uint8_t dayContrast = 255;
uint8_t nightContrast = 16;
int nightFrom = 23;
int nightTo = 6;
// Optional on/off window from the config's `schedule` (absent = always on).
bool scheduleEnabled = false;
int scheduleOn = 360;
int scheduleOff = 1380;
int scheduleDays = 127;

unsigned long lastApiFetch = 0;
unsigned long lastScreenUpdate = 0;
unsigned long lastMetricsUpdate = 0;
unsigned long lastClaimAttempt = 0;
unsigned long lastHelloAttempt = 0;
unsigned long buttonDownAt = 0;

// Last composed layout from GET <DEVICE_API>/screens; pages rotate every page's durationMs.
JsonDocument screens;
int pageIndex = 0;
unsigned long pageShownAt = 0;

WiFiManager wm;
#ifdef SHOW_BACKEND_URL_FIELD
WiFiManagerParameter backendUrlParam("server", "Backend API Base URL", BACKEND_URL, 127);
#endif

// Function Declarations
bool due(unsigned long& last, unsigned long interval, unsigned long now);
String readFile(const char* path);
void writeFile(const char* path, const String& content);
void setBackendUrl(const String& url);
String normalizedUrl(const String& raw);
String apName();
String apiUrl(const char* path);
String loadOrCreateDeviceId();
void applyTimezone(const String& tz);
bool insideSchedule();
int httpRequest(const char* method, const String& url, const String& body, String* response, bool authenticated);
void openPortal();
void closePortal();
void onWifiConnected();
void handleButton(unsigned long now);
void factoryReset();
void newPairingCode();
void enterClaiming();
void resetToClaiming();
void fetchHello();
int postClaim();
void tickClaiming(unsigned long now);
void tickPolling(unsigned long now);
void refreshFromServer();
int fetchConfiguration(bool& paired);
void applyConfig(JsonDocument& doc);
void maybeMoveBackend(const char* raw);
void loadCachedConfig();
bool loadScreens(const String& json);
void loadCachedScreens();
bool fetchScreens();
int pageCount();
unsigned long pageDurationMs(int index);
bool listsNeedRefetch(unsigned long msSinceLastFetch);
void sendMetrics();
void drawScreen();
void showMessage(const char* title, const char* line);

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  displayBegin();
  applyContrast(dayContrast);

  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS Mount Failed");
  }

  // Start the radio before generating IDs/codes: esp_random() is only truly random with RF enabled.
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  deviceUUID = loadOrCreateDeviceId();
  String savedUrl = normalizedUrl(readFile(serverConfigFile));
  if (savedUrl.length() > 0) setBackendUrl(savedUrl);
  deviceToken = readFile(tokenConfigFile);

  wm.setConfigPortalBlocking(false);
  wm.setConnectTimeout(20);
#ifdef SHOW_BACKEND_URL_FIELD
  backendUrlParam.setValue(backendBaseUrl, 127);
  wm.addParameter(&backendUrlParam);
#endif

  if (deviceToken.length() == 0) {
    enterClaiming();
  } else {
    loadCachedConfig();
    loadCachedScreens();
    state = State::Running;
  }
  if (timezoneString.length() == 0) applyTimezone(DEFAULT_TZ);

  if (wm.getWiFiIsSaved()) {
    WiFi.begin();  // saved credentials; auto-reconnect keeps retrying in the background
  } else {
    openPortal();  // first boot: no timeout, the portal waits until the customer finishes setup
  }
  drawScreen();
}

void loop() {
  unsigned long now = millis();

  handleButton(now);
  if (holdHint) return;

  if (portalOpen) {
    wm.process();
    if (!wm.getConfigPortalActive()) closePortal();
  }

  bool online = WiFi.status() == WL_CONNECTED;
  if (online && isOffline) onWifiConnected();
  isOffline = !online;
  if (isOffline) serverOk = false;

  if (state == State::Claiming) {
    tickClaiming(now);
  } else {
    tickPolling(now);
  }

  unsigned long redrawEvery = (state == State::Running && !portalOpen) ? screenInterval : 2000;
  if (due(lastScreenUpdate, redrawEvery, now)) drawScreen();
  // Yield to the idle task instead of spinning a core at 100% (power, heat in a closed case).
  // 10 ms keeps the button and the setup portal responsive.
  delay(10);
}

// ==========================================
// SMALL HELPERS
// ==========================================

// True (and restarts the timer) when `interval` has passed; last == 0 means "run now".
bool due(unsigned long& last, unsigned long interval, unsigned long now) {
  if (last != 0 && now - last < interval) return false;
  last = now ? now : 1;
  return true;
}

String readFile(const char* path) {
  if (!LittleFS.exists(path)) return "";
  File f = LittleFS.open(path, "r");
  if (!f) return "";
  String s = f.readString();
  f.close();
  s.trim();
  return s;
}

void writeFile(const char* path, const String& content) {
  File f = LittleFS.open(path, "w");
  if (f) {
    f.print(content);
    f.close();
  }
}

void setBackendUrl(const String& url) {
  strncpy(backendBaseUrl, url.c_str(), sizeof(backendBaseUrl) - 1);
  backendBaseUrl[sizeof(backendBaseUrl) - 1] = '\0';
}

String normalizedUrl(const String& raw) {
  return String(normalizeBaseUrl(raw.c_str()).c_str());
}

String apName() {
  return "PTSpy-Setup-" + deviceUUID.substring(0, 4);
}

// path is relative to DEVICE_API, e.g. apiUrl("/config")
String apiUrl(const char* path) {
  return String(backendBaseUrl) + DEVICE_API + path;
}

// Random per install, not derived from the MAC (which is broadcast over the air, so guessable).
// A factory reset formats LittleFS, so the next owner gets a fresh identity.
String loadOrCreateDeviceId() {
  String id = readFile(idFile);
  if (id.length() == 36) return id;

  uint8_t b[16];
  esp_fill_random(b, sizeof(b));
  b[6] = (b[6] & 0x0F) | 0x40;  // RFC 4122 version 4
  b[8] = (b[8] & 0x3F) | 0x80;  // RFC 4122 variant
  char s[37];
  snprintf(s, sizeof(s), "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
           b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
           b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]);
  writeFile(idFile, s);
  return String(s);
}

void applyTimezone(const String& tz) {
  if (tz == timezoneString) return;
  timezoneString = tz;
  setenv("TZ", timezoneString.c_str(), 1);
  tzset();
}

// True unless a schedule is set and the local time is outside it. Without a synced clock we can't
// tell, so the display stays on.
bool insideSchedule() {
  if (!scheduleEnabled) return true;
  time_t now = time(nullptr);
  if (!isTimeValid(now)) return true;
  struct tm local;
  localtime_r(&now, &local);
  return isWithinSchedule(local.tm_hour * 60 + local.tm_min, local.tm_wday, scheduleOn, scheduleOff, scheduleDays);
}

// ==========================================
// HTTP (one place for every backend call)
// ==========================================

// Returns the HTTP status, or a negative HTTPClient error (connection refused, DNS, TLS...).
int httpRequest(const char* method, const String& url, const String& body, String* response, bool authenticated) {
  WiFiClient plainClient;
  WiFiClientSecure secureClient;
  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(10000);

  bool started;
  if (url.startsWith("https://")) {
    secureClient.setCACertBundle(rootca_crt_bundle_start);
    started = http.begin(secureClient, url);
  } else {
    started = http.begin(plainClient, url);
  }
  if (!started) return -1;

  if (authenticated) {
    http.addHeader("X-Device-ID", deviceUUID);
    http.addHeader("X-Device-Token", deviceToken);
  }
  if (body.length() > 0) http.addHeader("Content-Type", "application/json");

  int code = http.sendRequest(method, body);
  if (code == 200 && response) *response = http.getString();
  http.end();
  return code;
}

// ==========================================
// WI-FI, PORTAL & BUTTON
// ==========================================

void openPortal() {
  if (portalOpen) return;
  // No saved Wi-Fi: wait for the customer forever. Saved Wi-Fi: give up after 5 min and reconnect.
  wm.setConfigPortalTimeout(wm.getWiFiIsSaved() ? 300 : 0);
  wm.startConfigPortal(apName().c_str());
  portalOpen = true;
  lastScreenUpdate = 0;
}

void closePortal() {
  portalOpen = false;
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.mode(WIFI_STA);
    WiFi.begin();
  }
  lastScreenUpdate = 0;
}

void onWifiConnected() {
  Serial.printf("Wi-Fi connected, IP %s\n", WiFi.localIP().toString().c_str());
#ifdef SHOW_BACKEND_URL_FIELD
  String entered = normalizedUrl(backendUrlParam.getValue());
  if (entered.length() > 0 && entered != backendBaseUrl) {
    setBackendUrl(entered);
    writeFile(serverConfigFile, entered);
    Serial.printf("Persisted new backend URL: %s\n", backendBaseUrl);
  }
#endif
  // Non-blocking; the clock shows --:-- until the first sync lands.
  configTzTime(timezoneString.c_str(), "pool.ntp.org", "time.google.com");
  // Talk to the backend right away instead of waiting for the next interval.
  lastApiFetch = 0;
  lastClaimAttempt = 0;
  lastHelloAttempt = 0;
  lastMetricsUpdate = 0;
  lastScreenUpdate = 0;
}

void handleButton(unsigned long now) {
  bool down = digitalRead(BUTTON_PIN) == LOW;
  if (down && buttonDownAt == 0) buttonDownAt = now ? now : 1;
  if (buttonDownAt == 0) return;

  ButtonAction action = buttonActionFor(now - buttonDownAt, !down);
  if (!down) buttonDownAt = 0;

  switch (action) {
    case ButtonAction::FactoryReset:
      factoryReset();
      break;
    case ButtonAction::Hint:
      if (!holdHint) showMessage("Keep holding 10 s to factory reset", "Release now to cancel");
      holdHint = true;
      break;
    case ButtonAction::OpenPortal:
      openPortal();
      break;
    case ButtonAction::None:
      if (!down && holdHint) {
        holdHint = false;
        lastScreenUpdate = 0;
      }
      break;
  }
}

void factoryReset() {
  showMessage("Factory reset...", "Wi-Fi and pairing erased");
  wm.resetSettings();
  LittleFS.format();
  delay(1000);
  ESP.restart();  // the only intentional reboot: user-initiated
}

// ==========================================
// CLAIMING (first-time pairing)
// ==========================================

// Alphabet excludes visually ambiguous characters (0/O, 1/I). 32 symbols, so no modulo bias.
void newPairingCode() {
  static const char charset[] = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  pairingCode = "";
  for (int i = 0; i < 6; i++) {
    pairingCode += charset[esp_random() % (sizeof(charset) - 1)];
  }
  pairingUrl = pairBaseUrl.length() > 0 ? pairBaseUrl + "?code=" + pairingCode : "";
}

void enterClaiming() {
  state = State::Claiming;
  newPairingCode();
  statusLine = "";
  lastClaimAttempt = 0;
  lastScreenUpdate = 0;
}

void resetToClaiming() {
  Serial.println("Backend rejected our token repeatedly - returning to pairing mode");
  LittleFS.remove(tokenConfigFile);
  LittleFS.remove(configFile);
  LittleFS.remove(cacheFile);
  deviceToken = "";
  screens.clear();
  pageIndex = 0;
  authFailures = 0;
  enterClaiming();
}

void fetchHello() {
  String payload;
  if (httpRequest("GET", apiUrl("/hello"), "", &payload, false) != 200) return;
  JsonDocument doc;
  if (deserializeJson(doc, payload)) return;
  pairBaseUrl = String(doc["pairBaseUrl"] | "");
  pairingUrl = pairBaseUrl.length() > 0 ? pairBaseUrl + "?code=" + pairingCode : "";
  lastScreenUpdate = 0;
}

int postClaim() {
  JsonDocument req;
  req["pairingCode"] = pairingCode;
  req["deviceUuid"] = deviceUUID;
  String body;
  serializeJson(req, body);

  String payload;
  int code = httpRequest("POST", apiUrl("/claim"), body, &payload, false);
  if (code != 200) return code;

  JsonDocument doc;
  if (deserializeJson(doc, payload)) return -2;
  applyConfig(doc);
  if (deviceToken.length() == 0) return -2;  // a 200 without a token is useless; keep polling
  writeFile(configFile, payload);
  return 200;
}

void tickClaiming(unsigned long now) {
  if (isOffline) {
    statusLine = NO_WIFI_HINT;
    return;
  }
  if (pairBaseUrl.length() == 0 && due(lastHelloAttempt, 30000, now)) fetchHello();
  if (!due(lastClaimAttempt, 5000, now)) return;

  int code = postClaim();
  switch (claimActionFor(code)) {
    case ClaimAction::Success:
      Serial.println("Device successfully claimed and paired!");
      statusLine = "";
      state = State::Running;
      lastApiFetch = 0;  // fetch departures immediately
      break;
    case ClaimAction::NewCode:
      newPairingCode();
      statusLine = "Code expired - use the new code";
      break;
    case ClaimAction::Blocked:
      serverOk = true;
      statusLine = "Registered to another account";
      break;
    case ClaimAction::Retry:
      serverOk = code == 404;
      statusLine = serverOk ? String("Enter this code in the app")
                            : String(String("Server unreachable (") + code + ")");
      break;
  }
  lastScreenUpdate = 0;
}

// ==========================================
// CONFIGURATION (Running / Unpaired / Disabled)
// ==========================================

void tickPolling(unsigned long now) {
  // Page rotation runs offline too: cached pages keep cycling.
  if (state == State::Running && pageCount() > 1) {
    if (pageShownAt == 0) {
      pageShownAt = now;
    } else if (now - pageShownAt >= pageDurationMs(pageIndex)) {
      pageIndex = nextPage(pageIndex, pageCount());
      pageShownAt = now;
      lastScreenUpdate = 0;
    }
  }

  if (isOffline) return;
  // Cheap gate first: an early refetch is never allowed within 30 s, so skip walking the layout until then.
  if (state == State::Running && now - lastApiFetch >= 30000UL && listsNeedRefetch(now - lastApiFetch)) {
    lastApiFetch = 0;
  }
  if (due(lastApiFetch, apiInterval, now)) refreshFromServer();
  if (state == State::Running && due(lastMetricsUpdate, metricsInterval, now)) sendMetrics();
}

// Config on every cycle, so changes made in the app (station, theme, timezone, unpair, disable) apply
// without a reboot. Screens follow when the device is paired.
void refreshFromServer() {
  bool paired = false;
  int code = fetchConfiguration(paired);
  ConfigAction action = configActionFor(code);
  authFailures = action == ConfigAction::AuthFailure ? authFailures + 1 : 0;

  switch (action) {
    case ConfigAction::Apply:
      serverOk = true;
      if (!paired) {
        state = State::Unpaired;
        break;
      }
      state = State::Running;
      serverOk = fetchScreens();
      break;
    case ConfigAction::AuthFailure:
      serverOk = false;
      if (shouldResetIdentity(authFailures)) resetToClaiming();
      break;
    case ConfigAction::Disabled:
      serverOk = true;
      state = State::Disabled;
      break;
    case ConfigAction::Transient:
      serverOk = false;
      break;
  }
  lastScreenUpdate = 0;
}

int fetchConfiguration(bool& paired) {
  String payload;
  int code = httpRequest("GET", apiUrl("/config"), "", &payload, true);
  if (code != 200) {
    Serial.printf("GET " DEVICE_API "/config -> %d\n", code);
    return code;
  }

  JsonDocument doc;
  if (deserializeJson(doc, payload)) return -2;
  applyConfig(doc);
  paired = doc["isPaired"] | false;
  if (!paired) {
    pairingCode = String(doc["pairingCode"] | "");
    pairingUrl = String(doc["pairingUrl"] | "");
  }
  writeFile(configFile, payload);
  maybeMoveBackend(doc["backendBaseUrl"] | "");
  return 200;
}

void applyConfig(JsonDocument& doc) {
  stationName = String(doc["stationName"] | "");
  apiInterval = clampMs(doc["apiInterval"] | 300000L, 5000UL, 3600000UL, 300000UL);
  screenInterval = clampMs(doc["screenInterval"] | 15000L, 1000UL, 60000UL, 15000UL);
  metricsInterval = clampMs(doc["metricsInterval"] | 600000L, 60000UL, 86400000UL, 600000UL);

  // Optional fields: older backends don't send them; the defaults keep the panel safe.
  dayContrast = doc["contrast"] | 255;
  nightContrast = doc["nightContrast"] | 16;
  nightFrom = doc["nightFrom"] | 23;
  nightTo = doc["nightTo"] | 6;

  applyTimezone(String(doc["timezone"] | DEFAULT_TZ));

  JsonObject schedule = doc["schedule"];
  scheduleEnabled = !schedule.isNull();
  if (scheduleEnabled) {
    scheduleOn = constrain((int)(schedule["on"] | 360), 0, 1439);
    scheduleOff = constrain((int)(schedule["off"] | 1380), 0, 1439);
    scheduleDays = constrain((int)(schedule["days"] | 127), 1, 127);
  }

  String token = String(doc["deviceToken"] | "");
  if (token.length() > 0 && token != deviceToken) {
    deviceToken = token;
    writeFile(tokenConfigFile, deviceToken);
    Serial.println("Saved device authentication token to LittleFS.");
  }
}

// Lets the backend move the whole fleet to a new domain without a reflash.
void maybeMoveBackend(const char* raw) {
  String next = normalizedUrl(raw);
  if (next.length() == 0 || next.length() >= sizeof(backendBaseUrl) || next == backendBaseUrl) return;
  // Only move to a server that actually answers; a typo on the backend must not strand the fleet.
  if (httpRequest("GET", next + DEVICE_API "/hello", "", nullptr, false) != 200) return;
  Serial.printf("Backend moved to %s\n", next.c_str());
  setBackendUrl(next);
  writeFile(serverConfigFile, next);
}

void loadCachedConfig() {
  String json = readFile(configFile);
  if (json.length() == 0) return;
  JsonDocument doc;
  if (!deserializeJson(doc, json)) applyConfig(doc);
}

// ==========================================
// SCREENS (server-composed widget layout)
// ==========================================

// Only a layout with at least one page replaces the current one, so a bad response never blanks the board.
bool loadScreens(const String& json) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) {
    Serial.println("Screens JSON invalid");
    return false;
  }
  JsonArray pages = doc["pages"];
  if (pages.isNull() || pages.size() == 0) return false;
  screens = std::move(doc);
  if (pageIndex >= pageCount()) pageIndex = 0;
  return true;
}

void loadCachedScreens() {
  String json = readFile(cacheFile);
  if (json.length() > 0) loadScreens(json);
}

bool fetchScreens() {
  String payload;
  int code = httpRequest("GET", apiUrl("/screens"), "", &payload, true);
  if (code != 200) {
    Serial.printf("GET " DEVICE_API "/screens -> %d\n", code);
    return false;
  }
  if (!loadScreens(payload)) return false;
  writeFile(cacheFile, payload);
  return true;
}

int pageCount() {
  int n = screens["pages"].size();
  return n > MAX_PAGES ? MAX_PAGES : n;
}

unsigned long pageDurationMs(int index) {
  return clampMs(screens["pages"][index]["durationMs"] | 15000L, 2000UL, 300000UL, 15000UL);
}

// True when any departure list is running out of rows (see shouldFetchEarly).
bool listsNeedRefetch(unsigned long msSinceLastFetch) {
  time_t now = time(nullptr);
  if (!isTimeValid(now)) return false;
  for (int p = 0; p < pageCount(); p++) {
    for (JsonObject w : screens["pages"][p]["widgets"].as<JsonArray>()) {
      if (strcmp(w["t"] | "", "list") != 0) continue;
      int fetched = 0;
      int upcoming = 0;
      for (JsonObject item : w["items"].as<JsonArray>()) {
        if (fetched == MAX_LIST_ITEMS) break;
        fetched++;
        if (listItemVisible(item["ts"] | 0L, now, w["leadSec"] | 0L, true)) upcoming++;
      }
      if (shouldFetchEarly(upcoming, fetched, w["maxRows"] | 3, msSinceLastFetch)) return true;
    }
  }
  return false;
}

// ==========================================
// METRICS & TELEMETRY
// ==========================================

void sendMetrics() {
  JsonDocument doc;
  doc["deviceId"] = deviceUUID;
  doc["stationName"] = stationName.length() > 0 ? stationName : String("unknown");  // backend requires non-empty
  doc["firmwareVersion"] = FIRMWARE_VERSION;

  doc["uptimeSeconds"] = millis() / 1000;
  doc["resetReason"] = (int)esp_reset_reason();
  doc["cpuFreqMHz"] = ESP.getCpuFreqMHz();

  doc["ramFreeBytes"] = ESP.getFreeHeap();
  doc["ramTotalBytes"] = ESP.getHeapSize();
  doc["ramMinFreeEver"] = ESP.getMinFreeHeap();
  doc["ramMaxAllocBlock"] = ESP.getMaxAllocHeap();

  doc["fsTotalBytes"] = LittleFS.totalBytes();
  doc["fsUsedBytes"] = LittleFS.usedBytes();

  doc["wifiSignalRssi"] = WiFi.RSSI();
  doc["wifiBssid"] = WiFi.BSSIDstr();
  doc["wifiChannel"] = WiFi.channel();

  String body;
  serializeJson(doc, body);
  int code = httpRequest("POST", apiUrl("/metrics"), body, nullptr, true);
  Serial.printf("POST " DEVICE_API "/metrics -> %d\n", code);
}

// ==========================================
// SCREEN SELECTION (drawing lives in display.cpp)
// ==========================================

void drawScreen() {
  if (portalOpen) {
    setPanelPower(true);
    applyContrast(dayContrast);
    drawWifiSetupScreen(apName());
    return;
  }
  // Switched off by the owner, or outside the on/off schedule: blank panel, everything keeps running.
  bool off = state == State::Disabled || (state == State::Running && !insideSchedule());
  setPanelPower(!off);
  if (off) return;

  switch (state) {
    case State::Claiming:
      applyContrast(dayContrast);
      drawPairingScreen(pairingCode, pairingUrl, statusLine);
      break;
    case State::Unpaired:
      applyContrast(dayContrast);
      drawPairingScreen(pairingCode, pairingUrl, isOffline ? NO_WIFI_HINT : "Enter this code in the app");
      break;
    case State::Disabled:
      break;  // panel is powered off above
    case State::Running: {
      if (pageCount() == 0) {
        showMessage("Loading departures...", isOffline ? NO_WIFI_HINT : "");
        break;
      }
      time_t now = time(nullptr);
      struct tm local;
      localtime_r(&now, &local);
      bool night = isTimeValid(now) && isNightHour(local.tm_hour, nightFrom, nightTo);
      applyContrast(night ? nightContrast : dayContrast);
      renderPage(screens["pages"][pageIndex]["widgets"].as<JsonArray>(), isOffline, isOffline || !serverOk);
      break;
    }
  }
}

// Full-brightness message that shows even while the panel is scheduled off.
void showMessage(const char* title, const char* line) {
  applyContrast(dayContrast);
  drawMessage(title, line);
}
